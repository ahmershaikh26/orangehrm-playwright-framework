import { AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const ROOT = process.cwd();
const REPORTS_ROOT = path.join(ROOT, 'Reports');
const ARTIFACTS = path.join(ROOT, 'artifacts');

const execP = (cmd: string, cwd = ROOT): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const p = exec(cmd, { cwd, env: process.env }, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '' });
    });
    p.stdout?.pipe(process.stdout);
    p.stderr?.pipe(process.stderr);
  });

async function ensureDir(dir: string) {
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch {}
}

function makeStamp(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function copyDirIfExists(src: string, dest: string) {
  try {
    if (!fs.existsSync(src)) return false;
    await ensureDir(dest);
    const items = await fs.promises.readdir(src);
    for (const it of items) {
      const s = path.join(src, it);
      const t = path.join(dest, it);
      const stat = await fs.promises.stat(s);
      if (stat.isDirectory()) {
        await copyDirIfExists(s, t);
      } else {
        await fs.promises.copyFile(s, t);
      }
    }
    return true;
  } catch (err) {
    console.warn('[auto-report] copyDirIfExists failed', (err as Error).message);
    return false;
  }
}

async function ensureSingleReportDir(): Promise<string> {
  // If REPORTS_DIR set externally (preferred), use it
  if (process.env.REPORTS_DIR && fs.existsSync(process.env.REPORTS_DIR)) {
    return path.resolve(process.env.REPORTS_DIR);
  }

  // If a REPORT_STAMP already in env, use it (and create dir)
  if (process.env.REPORT_STAMP) {
    const dir = path.join(REPORTS_ROOT, process.env.REPORT_STAMP);
    await ensureDir(dir);
    process.env.REPORTS_DIR = dir;
    return dir;
  }

  // Otherwise create a single stamp folder for this run and export it
  await ensureDir(REPORTS_ROOT);
  const stamp = makeStamp();
  const out = path.join(REPORTS_ROOT, stamp);
  await ensureDir(out);
  process.env.REPORT_STAMP = stamp;
  process.env.REPORTS_DIR = out;

  // Guard against bad env/path (prevents json:/cucumber.json type issues)
  const resolved = path.resolve(process.env.REPORTS_DIR);
  if (resolved === path.sep) {
    throw new Error(`[auto-report] REPORTS_DIR resolved to filesystem root ("/"). Refusing to continue.`);
  }

  return out;
}

async function waitForFileStable(filePath: string, timeoutMs = 5000, stableMs = 500): Promise<boolean> {
  const start = Date.now();
  let lastSize = -1;
  let lastChange = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const st = await fs.promises.stat(filePath);
      const size = st.size;
      if (size !== lastSize) {
        lastSize = size;
        lastChange = Date.now();
      } else {
        // size unchanged since last check
        if (Date.now() - lastChange >= stableMs) return true;
      }
    } catch (e) {
      // file might not exist yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  // timed out; return whether file exists and non-empty
  try {
    const st = await fs.promises.stat(filePath);
    return st.size > 0;
  } catch {
    return false;
  }
}

async function waitForNonEmptyJson(filePath: string, timeoutMs = 20000, intervalMs = 300): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const st = await fs.promises.stat(filePath);
      if (st.size > 5) {
        const raw = await fs.promises.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return true;
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) return true;
      }
    } catch {
      // ignore until ready
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function waitForParseableJsonFile(filePath: string, timeoutMs = 60_000, pollMs = 400): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const st = await fs.promises.stat(filePath);
      if (!st.isFile() || st.size === 0) {
        await new Promise((r) => setTimeout(r, pollMs));
        continue;
      }

      const raw = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);

      // Accept array/object (including empty array)
      if (Array.isArray(parsed)) return true;
      if (parsed && typeof parsed === 'object') return true;
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}

function cleanupReportDir(reportDir: string) {
  for (const item of fs.readdirSync(reportDir)) {
    const p = path.join(reportDir, item);
    try {
      const st = fs.lstatSync(p);
      if (!st.isDirectory()) continue;

      if (item === 'figma-cache' || item === 'visual' || item.startsWith('migrated_artifacts_')) {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`[auto-report] removed folder: ${p}`);
      }
    } catch {}
  }
}

async function pickBestCucumberJson(reportCuke: string, artifactsCuke: string): Promise<string | null> {
  const candidates = [reportCuke, artifactsCuke];

  let best: { path: string; size: number; mtimeMs: number } | null = null;

  for (const p of candidates) {
    try {
      const st = await fs.promises.stat(p);
      if (!st.isFile()) continue;

      const cur = { path: p, size: st.size, mtimeMs: st.mtimeMs };
      if (!best) best = cur;
      else if (cur.size > best.size) best = cur;
      else if (cur.size === best.size && cur.mtimeMs > best.mtimeMs) best = cur;
    } catch {
      // ignore missing
    }
  }

  return best?.path ?? null;
}

async function runReports() {
  const reportDir = await ensureSingleReportDir();
  console.log(`[auto-report] using REPORTS_DIR=${reportDir}`);

  // If you run via scripts/run-cucumber.ts, it will generate cucumber HTML after the process exits.
  // Skip it here to avoid timing/race issues with cucumber.json flush.
  const skipCucumberHtml = process.env.SKIP_CUCUMBER_HTML === '1';

  if (!skipCucumberHtml) {
    const reportCuke = path.join(reportDir, 'cucumber.json');
    const artifactsCuke = path.join(ARTIFACTS, 'cucumber.json');
    const destCuke = reportCuke;

    // Wait until artifacts cucumber.json is actually written AND parseable
    const ok = await waitForParseableJsonFile(artifactsCuke, 60_000, 400);

    if (!ok) {
      console.warn(`[auto-report] cucumber.json not ready/parseable at: ${artifactsCuke}`);
    } else {
      // Copy to report dir
      await fs.promises.copyFile(artifactsCuke, destCuke);
      const st = await fs.promises.stat(destCuke);
      console.log(`[auto-report] copied cucumber.json -> ${destCuke} (${st.size} bytes)`);

      console.log('[auto-report] Generating cucumber HTML...');
      await execP(`npx ts-node "${path.join(ROOT, 'src', 'report-tool', 'generate-cucumber-html.ts')}"`);
    }
  } else {
    console.log('[auto-report] SKIP_CUCUMBER_HTML=1, skipping cucumber HTML generation in AfterAll');
  }

  console.log('[auto-report] Running richer report generator...');
  await execP(`npx ts-node "${path.join(ROOT, 'src', 'report-tool', 'richer-report.ts')}"`);

  // Generate Allure
  const allureSrc = path.join(reportDir, 'allure-results');
  if (fs.existsSync(allureSrc) && fs.readdirSync(allureSrc).length > 0) {
    console.log('[auto-report] Generating Allure HTML into report folder...');
    const out = path.join(reportDir, 'allure-report');
    await execP(`npx allure generate "${allureSrc}" -o "${out}" --clean`);
    console.log('[auto-report] Allure report generated at:', out);
  } else {
    console.log('[auto-report] No Allure results found in report folder — skipping Allure generation.');
  }

  // Final cleanup so unwanted folders never remain
  cleanupReportDir(reportDir);

  console.log('[auto-report] done.');
}

setDefaultTimeout(5 * 60 * 1000);

AfterAll(async () => {
  try {
    await runReports();
  } catch (err) {
    console.error('[auto-report] Automatic report generation failed:', (err as Error).message);
  }
});

console.log('[auto-report] module loaded (hooks registered)');
