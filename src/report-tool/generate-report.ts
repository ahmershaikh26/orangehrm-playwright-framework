import fs from 'fs';
import path from 'path';

const REPORTS_DIR = process.env.REPORTS_DIR ? path.resolve(process.env.REPORTS_DIR) : null;
const OUT_BASE = REPORTS_DIR || path.resolve('Reports', new Date().toISOString().replace(/[:T]/g, '_').split('.')[0]);
const OUT = path.join(OUT_BASE, 'summary-report.html');

const PLAYWRIGHT_HTML = path.join(OUT_BASE, 'playwright-html-report', 'index.html');
const PLAYWRIGHT_JSON = path.join(OUT_BASE, 'playwright-report.json');
const CUCUMBER_JSON = path.join(OUT_BASE, 'cucumber.json');
const SCREENSHOTS_DIR = path.join(OUT_BASE, 'screenshots');
const VIDEOS_DIR = path.join(OUT_BASE, 'videos');
const VISUAL_CUR = path.join(OUT_BASE, 'visual', 'current');
const FIGMA_CACHE = path.join(OUT_BASE, 'figma-cache');

function safeList(dir: string) {
  try {
    return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  } catch {
    return [];
  }
}

function assetLink(relPath: string) {
  return relPath.split(path.sep).join('/');
}

function makeSection(title: string, content: string) {
  return `<section style="margin:18px 0"><h2>${title}</h2>${content}</section>`;
}

function mkImgTag(src: string, alt = '', w = 380) {
  return `<a href="${assetLink(src)}" target="_blank"><img src="${assetLink(src)}" alt="${alt}" style="max-width:${w}px;max-height:220px;border:1px solid #ddd;padding:4px;margin:6px" /></a>`;
}

function mkVideoTag(src: string) {
  return `<video controls style="max-width:640px;margin:8px" src="${assetLink(src)}"></video>`;
}

async function generate() {
  const parts: string[] = [];

  const time = new Date().toISOString();
  parts.push(`<div style="font-family:Inter,Helvetica,Arial;margin:12px"><h1>Test Run Summary</h1><div>Generated: ${time}</div><div>Report folder: ${OUT_BASE}</div></div>`);

  if (fs.existsSync(PLAYWRIGHT_HTML)) {
    parts.push(makeSection('Playwright HTML Report', `<a href="${assetLink(path.relative(path.dirname(OUT), PLAYWRIGHT_HTML))}" target="_blank">Open Playwright HTML Report</a>`));
  } else {
    parts.push(makeSection('Playwright HTML Report', '<em>Not generated</em>'));
  }

  if (fs.existsSync(PLAYWRIGHT_JSON)) {
    try {
      const json = JSON.parse(fs.readFileSync(PLAYWRIGHT_JSON, 'utf8'));
      const tests = (json?.suites || []).flatMap((s: any) => (s?.specs || []).flatMap((sp: any) => sp?.tests || []));
      const failed = tests.filter((t: any) => t.results && t.results.some((r: any) => r.status === 'failed'));
      const total = tests.length;
      parts.push(makeSection('Playwright JSON Summary', `<div>Total tests: ${total}</div><div>Failed: ${failed.length}</div>`));
    } catch (e) {
      parts.push(makeSection('Playwright JSON Summary', `<pre>Failed to parse JSON: ${(e as Error).message}</pre>`));
    }
  }

  const screenshots = safeList(SCREENSHOTS_DIR).map(f => path.join(path.relative(OUT_BASE, SCREENSHOTS_DIR), f));
  if (screenshots.length) {
    const imgs = screenshots.map(p => mkImgTag(path.join(path.relative(path.dirname(OUT), OUT_BASE), p), path.basename(p), 360)).join('');
    parts.push(makeSection('Screenshots', imgs));
  } else {
    parts.push(makeSection('Screenshots', '<em>No screenshots found</em>'));
  }

  const visualFiles = safeList(VISUAL_CUR).map(f => path.join(path.relative(OUT_BASE, VISUAL_CUR), f));
  if (visualFiles.length) {
    const imgs = visualFiles.filter(f => /\.(png|jpg|jpeg)$/i.test(f)).map(p => mkImgTag(path.join(path.relative(path.dirname(OUT), OUT_BASE), p), path.basename(p), 360)).join('');
    parts.push(makeSection('Visual Current / Diffs', imgs));
  }

  const videos = safeList(VIDEOS_DIR).map(f => path.join(path.relative(OUT_BASE, VIDEOS_DIR), f));
  if (videos.length) {
    const vids = videos.map(v => mkVideoTag(path.join(path.relative(path.dirname(OUT), OUT_BASE), v))).join('');
    parts.push(makeSection('Videos', vids));
  } else {
    parts.push(makeSection('Videos', '<em>No videos found</em>'));
  }

  if (fs.existsSync(CUCUMBER_JSON)) {
    const rel = path.join(path.relative(path.dirname(OUT), OUT_BASE), 'cucumber.json');
    parts.push(makeSection('Cucumber JSON', `<a href="${assetLink(rel)}" target="_blank">Open cucumber JSON</a>`));
  }

  const html = `<!doctype html>
  <html><head><meta charset="utf-8"><title>Test Run Summary</title>
  <style>body{font-family:Inter,Arial,Helvetica;background:#fff;color:#111;padding:18px} h1{margin-bottom:6px}</style>
  </head><body>${parts.join('\n')}</body></html>`;

  try { fs.mkdirSync(path.dirname(OUT), { recursive: true }); } catch {}
  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`Summary report written to: ${OUT}`);
}

generate().catch(err => {
  console.error('Failed to generate summary report:', err);
  process.exit(1);
});