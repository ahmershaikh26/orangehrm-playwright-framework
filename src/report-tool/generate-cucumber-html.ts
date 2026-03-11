import fs from 'fs';
import path from 'path';
// @ts-ignore: no type declarations for 'multiple-cucumber-html-reporter'
import { generate } from 'multiple-cucumber-html-reporter';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForValidCucumberJson(jsonPath: string, timeoutMs = 60_000, pollMs = 400): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const raw = await fs.promises.readFile(jsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return;
      if (parsed && typeof parsed === 'object') return;
    } catch {
      // ignore until ready
    }
    await sleep(pollMs);
  }
  throw new Error(`Timed out waiting for valid cucumber.json: ${jsonPath}`);
}

async function run() {
  const jsonDir = process.env.REPORTS_DIR ? path.resolve(process.env.REPORTS_DIR) : '';
  if (!jsonDir) {
    throw new Error('[cucumber-html] REPORTS_DIR is not set');
  }

  const jsonPath = path.join(jsonDir, 'cucumber.json');
  const outDir = path.join(jsonDir, 'cucumber-html-report');

  console.log('[cucumber-html] REPORTS_DIR:', jsonDir);
  console.log('[cucumber-html] jsonPath:', jsonPath);
  console.log('[cucumber-html] outDir:', outDir);

  await waitForValidCucumberJson(jsonPath, 60_000, 400);

  // remove broken previous build
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch {}

  generate({
    jsonDir,
    reportPath: outDir,
    metadata: {
      browser: { name: process.env.BROWSER ?? 'chromium', version: '' },
      device: process.platform,
      platform: { name: process.platform },
    },
    customData: {
      title: 'Run info',
      data: [
        { label: 'User', value: process.env.USER || '' },
        { label: 'Base URL', value: process.env.BASE_URL || '' },
        { label: 'Timestamp', value: new Date().toISOString() },
      ],
    },
  });

  // sanity check: index.html exists
  const indexHtml = path.join(outDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    throw new Error(`Cucumber HTML generation produced no index.html at: ${indexHtml}`);
  }

  console.log('[cucumber-html] generated:', indexHtml);
}

run().catch((e) => {
  console.error('[cucumber-html] Failed:', e);
  process.exit(1);
});