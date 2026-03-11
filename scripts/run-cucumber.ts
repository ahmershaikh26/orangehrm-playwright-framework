import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const ROOT = process.cwd();
const REPORTS_ROOT = path.join(ROOT, 'Reports');
const ARTIFACTS = path.join(ROOT, 'artifacts');

type RunPass = { suffix: string; uiMode: string; headless: boolean };

// Default: one pass only (headed). Enable multi-pass explicitly via RUN_PASSES=headed,headless
function computePasses(): RunPass[] {
  const raw = String(process.env.RUN_PASSES ?? '').trim();

  // If not provided, run ONCE (headed)
  if (!raw) {
    return [{ suffix: 'headed', uiMode: 'desktop', headless: false }];
  }

  const parts = raw
    .split(/[,\s|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const out: RunPass[] = [];
  for (const p of parts) {
    if (p === 'headed') out.push({ suffix: 'headed', uiMode: 'desktop', headless: false });
    else if (p === 'headless') out.push({ suffix: 'headless', uiMode: 'desktop', headless: true });
  }

  // Fallback safety
  return out.length ? out : [{ suffix: 'headed', uiMode: 'desktop', headless: false }];
}

const passes = computePasses();

function makeStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function execStreaming(cmd: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<number>((resolve, reject) => {
    const p = spawn(cmd, args, { env, stdio: 'inherit', cwd: ROOT, shell: false });
    p.on('error', reject);
    p.on('close', (code) => resolve(code ?? 1));
  });
}

function sanitizeLegacyCucumberJsonInPlace(jsonPath: string) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const doc = JSON.parse(raw);

  if (!Array.isArray(doc)) return;

  const isHookStep = (s: any) => {
    const kw = String(s?.keyword ?? '').trim().toLowerCase(); // "Before", "After"
    const hidden = s?.hidden === true;
    return hidden || kw === 'before' || kw === 'after';
  };

  for (const feature of doc) {
    const elements = feature?.elements;
    if (!Array.isArray(elements)) continue;

    for (const scenario of elements) {
      const steps = scenario?.steps;
      if (!Array.isArray(steps)) continue;

      // Remove hook steps entirely so they never appear in HTML report
      scenario.steps = steps.filter((s: any) => !isHookStep(s));
    }
  }

  fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2), 'utf8');
}

function getArgValue(argv: string[], name: string): string | null {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function tagsMention(expr: string | null, tag: string): boolean {
  if (!expr) return false;
  return expr.toLowerCase().includes(tag.toLowerCase());
}

function mergeLegacyCucumberJsonFiles(jsonFiles: string[]): any[] {
  const merged: any[] = [];
  for (const f of jsonFiles) {
    const raw = fs.readFileSync(f, 'utf8').trim();
    if (!raw) continue;
    const doc = JSON.parse(raw);
    if (Array.isArray(doc)) merged.push(...doc);
  }
  return merged;
}

function upsertArg(argv: string[], flag: string, value: string): string[] {
  const out = [...argv];
  const idx = out.indexOf(flag);
  if (idx === -1) return out.concat([flag, value]);
  out[idx + 1] = value;
  return out;
}

function removeFormatters(argv: string[]): string[] {
  // remove all occurrences of: --format <value>
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--format') {
      i++; // skip next (value)
      continue;
    }
    out.push(argv[i]);
  }
  return out;
}

async function main() {
  fs.mkdirSync(REPORTS_ROOT, { recursive: true });
  fs.mkdirSync(ARTIFACTS, { recursive: true });

  const stamp = process.env.REPORT_STAMP || makeStamp();
 // const reportDir = process.env.REPORTS_DIR || path.join(REPORTS_ROOT, stamp);
 // fs.mkdirSync(reportDir, { recursive: true });

  const env = { ...process.env, REPORT_STAMP: stamp, SKIP_CUCUMBER_HTML: '1' };

  // CLI args passed by user (tags, feature paths, etc.)
  const cliArgs = process.argv.slice(2);

  // REQUIRED for your framework to load TS steps + support
  const baseArgs = [
    '--require-module',
    'ts-node/register',
    '--require',
    'tests/support/playwright-world.ts',
    '--require',
    'tests/support/auto-report.ts',
    '--require',
    'tests/steps/**/*.ts',
  ];

  const parallel = Math.max(1, Number(process.env.PARALLEL ?? '4'));
  let lastCode = 0;

  for (const p of passes) {
    const passStamp = `${stamp}_${p.suffix}`;
    const passReportDir = path.join(REPORTS_ROOT, passStamp);
    fs.mkdirSync(passReportDir, { recursive: true });

    const passEnv = {
      ...env,
      UI_MODE: p.uiMode,
      REPORT_STAMP: passStamp,
      REPORTS_DIR: passReportDir,
      SKIP_CUCUMBER_HTML: '1',
      PARALLEL: String(parallel),
    };

    const passMessages = path.join(ARTIFACTS, `messages-${passStamp}.ndjson`);
    const passCucumberJsonReport = path.join(passReportDir, 'cucumber.json');

    // Merge base + cli, then enforce our formatter + parallel settings
    let passArgs = baseArgs.concat(cliArgs);

    // remove any user-provided formatters to avoid conflicts
    passArgs = removeFormatters(passArgs);

    // default features if user didn't pass any .feature paths
    const hasFeature = passArgs.some((a) => a.endsWith('.feature'));
    if (!hasFeature) passArgs.push('tests/features/**/*.feature');

    passArgs = upsertArg(passArgs, '--parallel', String(parallel));
    passArgs = passArgs.concat(['--format', 'progress', '--format', `message:${passMessages}`]);

    console.log(`[run] pass=${p.uiMode} parallel=${parallel} REPORTS_DIR=${passReportDir}`);
    lastCode = await execStreaming('npx', ['cucumber-js', ...passArgs], passEnv);

    // Convert messages -> legacy cucumber.json (combined)
    const conv = await execStreaming(
      'npx',
      ['ts-node', 'scripts/converter-cucumber.ts', passMessages, passCucumberJsonReport],
      passEnv,
    );
    if (conv !== 0) process.exit(conv);

    try {
      sanitizeLegacyCucumberJsonInPlace(passCucumberJsonReport);
    } catch {}

    const genCuke = await execStreaming('npx', ['ts-node', 'src/report-tool/generate-cucumber-html.ts'], passEnv);
    if (genCuke !== 0) process.exit(genCuke);

    const genSummary = await execStreaming('npx', ['ts-node', 'src/report-tool/richer-report.ts'], passEnv);
    if (genSummary !== 0) process.exit(genSummary);
  }

  process.exit(lastCode);
}

main().catch((e) => {
  console.error('[run] failed:', e);
  process.exit(1);
});