import path from 'path';
import fs from 'fs-extra';
import dayjs from 'dayjs';
import sanitize from 'sanitize-filename';
import { AITriage } from '../utils/ai-triage.util';
import { exec as childExec } from 'child_process';

const REPORTS_DIR = process.env.REPORTS_DIR ? path.resolve(process.env.REPORTS_DIR) : null;
const ARTIFACTS_DIR = REPORTS_DIR ?? path.resolve('artifacts');
const ARTIFACTS = ARTIFACTS_DIR;
const REPORTS_ROOT = path.resolve('Reports');

// Project root (assumes this file lives at <root>/src/report-tool/richer-report.ts)
const ROOT = path.resolve(__dirname, '..', '..');

// Use existing REPORTS_DIR when present (set by playwright-world), otherwise create a new stamp
function tsStamp() {
  return dayjs().format('YYYYMMDD_HHmmss');
}

async function copyIfExists(src: string, dest: string) {
  try {
    if (await fs.pathExists(src)) {
      await fs.copy(src, dest, { overwrite: true });
      return true;
    }
  } catch (err) {
    console.warn(`copyIfExists failed for ${src}: ${(err as Error).message}`);
  }
  return false;
}

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c] || c
  );
}

async function collectPlaywrightFailures(jsonPath: string) {
  if (!(await fs.pathExists(jsonPath))) return [];
  const raw = await fs.readFile(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  const failures: any[] = [];

  function collectSuite(suite: any, parents: string[] = []) {
    const titleStack = suite.title ? [...parents, suite.title] : parents;
    if (suite.specs && Array.isArray(suite.specs)) {
      for (const spec of suite.specs) {
        if (Array.isArray(spec.tests)) {
          for (const t of spec.tests) {
            const failed = (t.results || []).find((r: any) => r.status === 'failed');
            if (failed) {
              failures.push({
                title: t.title,
                file: spec.file,
                location: t.location,
                fullTitle: [...titleStack.filter(Boolean), t.title].join(' › '),
                failure: failed,
                annotations: t.annotations || [],
              });
            }
          }
        }
      }
    }
    if (Array.isArray(suite.suites)) {
      for (const s of suite.suites) collectSuite(s, titleStack);
    }
  }

  const suites = data.suites || [];
  for (const s of suites) collectSuite(s);
  return failures;
}

function mkImgTag(rel: string, w = 360) {
  const url = `./${rel.split(path.sep).join('/')}`;
  return `<a href="${url}" target="_blank"><img src="${url}" style="max-width:${w}px;max-height:220px;border:1px solid #ddd;padding:6px;margin:6px" /></a>`;
}

function mkVideoTag(rel: string) {
  const url = `./${rel.split(path.sep).join('/')}`;
  return `<video controls style="max-width:640px;margin:8px" src="${url}"></video>`;
}

async function waitForNonEmptyJson(filePath: string, timeoutMs = 60_000, intervalMs = 400) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf8');
        if (content.trim().length > 0) {
          const parsed = JSON.parse(content);
          if (parsed && (typeof parsed !== 'object' || Object.keys(parsed).length > 0)) return true;
        }
      }
    } catch {
      // ignore parse/read errors while the file is being written
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return false;
}

async function ensureSingleReportDir() {
  // decide outRoot: prefer process.env.REPORTS_DIR created by the world module
  const envReports = process.env.REPORTS_DIR ? path.resolve(process.env.REPORTS_DIR) : null;
  const stamp = tsStamp();
  await fs.ensureDir(REPORTS_ROOT);
  const outRoot = envReports || path.join(REPORTS_ROOT, stamp);
  await fs.ensureDir(outRoot);

  // create expected subfolders (if tests already wrote them they will be preserved)
  const sub = {
    screenshots: path.join(outRoot, 'screenshots'),
    videos: path.join(outRoot, 'videos'),
    ai: path.join(outRoot, 'ai'),
    playwrightHtml: path.join(outRoot, 'playwright-html-report'),
  };
  for (const v of Object.values(sub)) await fs.ensureDir(v);

  return { outRoot, sub };
}

async function generate() {
  const { outRoot, sub } = await ensureSingleReportDir();

  // If tests wrote into artifacts (legacy) copy from artifacts into the report folder (best-effort)
  const srcRoot = process.env.REPORTS_DIR ? process.env.REPORTS_DIR : ARTIFACTS_DIR;

  // copy from srcRoot only when different from outRoot (avoid self-copy)
  if (path.resolve(srcRoot) !== path.resolve(outRoot)) {
    await copyIfExists(path.join(srcRoot, 'screenshots'), sub.screenshots);
    await copyIfExists(path.join(srcRoot, 'videos'), sub.videos);
    // copy JSONs if present in srcRoot
    const pwJsonSrc = path.join(srcRoot, 'playwright-report.json');
    const cucumberJsonSrc = path.join(srcRoot, 'cucumber.json');
    if (await fs.pathExists(pwJsonSrc)) await fs.copy(pwJsonSrc, path.join(outRoot, 'playwright-report.json'));
    if (await fs.pathExists(cucumberJsonSrc)) await fs.copy(cucumberJsonSrc, path.join(outRoot, 'cucumber.json'));
  }

  // collect lists relative to outRoot
  const listFiles = async (d: string) => (await fs.pathExists(d) ? (await fs.readdir(d)).map(f => path.join(path.basename(d), f)) : []);
  const screenshots = await listFiles(sub.screenshots);
  const videos = await listFiles(sub.videos);

  // parse failures from playwright-report.json located in outRoot
  const pwJsonOut = path.join(outRoot, 'playwright-report.json');
  const failures = await collectPlaywrightFailures(pwJsonOut);

  function findAssetsForTitle(title: string) {
    const key = sanitize(title || '').replace(/\s+/g, '_').toLowerCase();
    const matchedScreens = screenshots.filter(s => s.toLowerCase().includes(key));
    const matchedVideos = videos.filter(v => v.toLowerCase().includes(key));
    return { matchedScreens, matchedVideos };
  }

  // AI triage (if available)
  let aiOutput = '';
  if (await fs.pathExists(pwJsonOut) && process.env.OPENAI_API_KEY) {
    try {
      aiOutput = await AITriage.summarizeFailures(pwJsonOut);
      await fs.writeFile(path.join(sub.ai, 'ai-triage.txt'), aiOutput, 'utf8');
    } catch (err) {
      aiOutput = `AI triage error: ${(err as Error).message}`;
      await fs.writeFile(path.join(sub.ai, 'ai-triage-error.txt'), aiOutput, 'utf8');
    }
  }

  // Build HTML (Bootstrap)
  const bootstrapCss = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css';
  const bootstrapJs = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js';

  const header = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Test Run Report - ${path.basename(outRoot)}</title>
    <link href="${bootstrapCss}" rel="stylesheet"/>
    <style>
      body{padding:20px;font-family:Inter,Arial,Helvetica}
      .thumb{border:1px solid #eee;padding:6px;background:#fff}
      pre.err{white-space:pre-wrap;background:#111;color:#fff;padding:12px}
    </style>
  </head>
  <body>
    <div class="container">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1>Test Run Report</h1>
        <div><small>${new Date().toLocaleString()}</small></div>
      </div>
  `;

  let bodyHtml = '';

  // summary box
  bodyHtml += `<div class="mb-3"><h4>Summary</h4><ul>`;
  bodyHtml += `<li>Report folder: ${escapeHtml(outRoot)}</li>`;
  bodyHtml += `<li>Playwright JSON: ${await fs.pathExists(pwJsonOut) ? `<a href="./playwright-report.json">playwright-report.json</a>` : 'Not found'}</li>`;
  bodyHtml += `<li>Playwright HTML report: ${await fs.pathExists(sub.playwrightHtml) ? `<a href="./playwright-html-report/index.html">Open HTML Report</a>` : 'Not found'}</li>`;
  bodyHtml += `<li>Screenshots: ${screenshots.length}</li>`;
  bodyHtml += `<li>Videos: ${videos.length}</li>`;
  bodyHtml += `</ul></div>`;

  if (aiOutput) {
    bodyHtml += `<div class="mb-4 card"><div class="card-body"><h5 class="card-title">AI Triage</h5><pre style="white-space:pre-wrap;font-family:monospace">${escapeHtml(aiOutput)}</pre></div></div>`;
  }

  const gallery = (title: string, files: string[], img = true) => {
    if (!files.length) return `<div class="mb-3"><h5>${title}</h5><div class="text-muted">None</div></div>`;
    let out = `<div class="mb-3"><h5>${title}</h5><div class="d-flex flex-wrap">`;
    for (const f of files) {
      out += `<div class="thumb">${img ? mkImgTag(path.join(outRoot, f)) : mkVideoTag(path.join(outRoot, f))}</div>`;
    }
    out += `</div></div>`;
    return out;
  };

  bodyHtml += gallery('Screenshots', screenshots, true);
  bodyHtml += gallery('Videos', videos, false);

  // Failures accordion
  bodyHtml += `<div class="mb-4"><h4>Failures (${failures.length})</h4>`;
  if (failures.length === 0) {
    bodyHtml += `<div class="alert alert-success">No failing tests detected.</div>`;
  } else {
    bodyHtml += `<div class="accordion" id="failuresAccordion">`;
    failures.forEach((f, idx) => {
      const fid = `fail-${idx}`;
      const title = escapeHtml(f.fullTitle || f.title);
      const failureMsg = escapeHtml(f.failure?.error || JSON.stringify(f.failure || {}, null, 2));
      const { matchedScreens, matchedVideos } = findAssetsForTitle(f.title || f.fullTitle || `test-${idx}`);
      bodyHtml += `
      <div class="accordion-item">
        <h2 class="accordion-header" id="heading-${fid}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${fid}" aria-expanded="false" aria-controls="collapse-${fid}">
            ${title} — ${escapeHtml(f.file || '')}
          </button>
        </h2>
        <div id="collapse-${fid}" class="accordion-collapse collapse" aria-labelledby="heading-${fid}" data-bs-parent="#failuresAccordion">
          <div class="accordion-body">
            <h6>Error</h6>
            <pre class="err">${failureMsg}</pre>
            <h6>Attachments</h6>
            <div class="d-flex flex-wrap">`;
      for (const s of matchedScreens) bodyHtml += `<div class="thumb">${mkImgTag(path.join(outRoot, s))}</div>`;
      for (const v of matchedVideos) bodyHtml += `<div class="mb-2">${mkVideoTag(path.join(outRoot, v))}</div>`;
      bodyHtml += `</div>`;
      bodyHtml += `<h6>Metadata</h6><pre>${escapeHtml(JSON.stringify({ annotations: f.annotations, location: f.location }, null, 2))}</pre>`;
      bodyHtml += `</div></div></div>`;
    });
    bodyHtml += `</div>`;
  }
  bodyHtml += `</div>`;

  const footer = `
    </div>
    <script src="${bootstrapJs}"></script>
  </body></html>
  `;

  const html = header + bodyHtml + footer;
  const outHtmlPath = path.join(outRoot, 'summary-report.html');
  await fs.writeFile(outHtmlPath, html, 'utf8');

  console.log(`Report created: ${outHtmlPath}`);
  if (aiOutput) console.log(`AI triage saved under: ${path.join(sub.ai, 'ai-triage.txt')}`);
}

if (require.main === module) {
  generate().catch((err) => {
    console.error('richer-report failed:', err);
    process.exit(1);
  });
}