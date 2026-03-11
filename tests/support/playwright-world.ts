import fs from 'fs';
import path from 'path';
import {
  After,
  AfterStep,
  Before,
  ITestStepHookParameter,
  IWorldOptions,
  setDefaultTimeout,
  setWorldConstructor,
} from '@cucumber/cucumber';
import { chromium, devices, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';

import type { Pages as AppPages } from './world';
import { LoginPage } from '../../src/pages/login.page';
import { DashboardPage } from '../../src/pages/dashboard.page';

// If you add more page objects in tests/support/world.ts, wire them here.
type Pages = AppPages;

class PlaywrightWorld {
  public attach: IWorldOptions['attach'];

  public browser?: Browser;
  public context?: BrowserContext;
  public page?: Page;

  private _pages?: Pages;

  constructor(options: IWorldOptions) {
    this.attach = options.attach;
  }

  get pages(): Pages {
    if (!this.page) throw new Error('[world] Playwright page is not initialized yet (did Before hook run?).');
    this._pages ??= {
      login: new LoginPage(this.page),
      dashboard: new DashboardPage(this.page),

      // NOTE:
      // Add rest of your pages here when available in your codebase, e.g.
      // leftNav: new LeftNav(this.page),
      // admin: new AdminPage(this.page),
      // systemUsers: new SystemUsersPage(this.page),
      // addUser: new AddUserPage(this.page),
    } as Pages;

    return this._pages;
  }

  resetPages() {
    this._pages = undefined;
  }
}

setWorldConstructor(PlaywrightWorld);
setDefaultTimeout(Number(process.env.STEP_TIMEOUT_MS ?? 60_000));

// ---------- Reports dirs ----------
const ROOT = process.cwd();

function makeStamp(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Do not create a base Reports/<stamp> here if runner already set REPORTS_DIR.
if (!process.env.REPORTS_DIR) {
  const stamp = process.env.REPORT_STAMP || makeStamp();
  process.env.REPORT_STAMP = stamp;
  process.env.REPORTS_DIR = path.join(ROOT, 'Reports', stamp);
}

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR!);
const SCREENSHOT_DIR = path.join(REPORTS_DIR, 'screenshots');
const STEP_SCREENSHOT_DIR = path.join(SCREENSHOT_DIR, 'steps');
const VIDEO_DIR = path.join(REPORTS_DIR, 'videos');

try {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(STEP_SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
} catch {}

// ---------- UI mode helper ----------
function getUiMode(): 'desktop' | 'mobile' {
  const m = String(process.env.UI_MODE ?? 'desktop').toLowerCase();
  return m === 'mobile' ? 'mobile' : 'desktop';
}

function safeFilePart(v: string, maxLen = 80) {
  return String(v ?? '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, maxLen);
}

// ---------- Hooks ----------

Before(async function (this: PlaywrightWorld) {
  const uiMode = getUiMode();

  const browserName = (process.env.BROWSER ?? 'chromium').toLowerCase();
  const browserType = browserName === 'firefox' ? firefox : browserName === 'webkit' ? webkit : chromium;

  const headless = process.env.HEADLESS ? process.env.HEADLESS !== 'false' : true;

  this.browser = await browserType.launch({ headless });

  if (uiMode === 'mobile') {
    const deviceName = process.env.MOBILE_DEVICE ?? 'iPhone 14';
    const device = devices[deviceName];
    if (!device) throw new Error(`[world] Unknown MOBILE_DEVICE="${deviceName}"`);

    this.context = await this.browser.newContext({
      ...device,
      baseURL: process.env.BASE_URL,
      recordVideo: { dir: VIDEO_DIR },
    });
  } else {
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      baseURL: process.env.BASE_URL,
      recordVideo: { dir: VIDEO_DIR },
    });
  }

  this.page = await this.context.newPage();
  this.resetPages();
});

After(async function (this: PlaywrightWorld) {
  try {
    if (this.page) await this.page.close();
  } catch {}
  try {
    if (this.context) await this.context.close();
  } catch {}
  try {
    if (this.browser) await this.browser.close();
  } catch {}

  this.page = undefined;
  this.context = undefined;
  this.browser = undefined;
  this.resetPages();
});

// Scenario-level screenshot on failure only (avoid duplicates if AfterStep screenshots are enabled)
After(async function (this: PlaywrightWorld, { pickle, result }) {
  try {
    if (!this.page) return;
    if (typeof this.attach !== 'function') return;

    const status = String(result?.status ?? 'UNKNOWN').toUpperCase();

    // FAIL | ALWAYS | OFF
    const takeOn = String(process.env.SCREENSHOT_ON ?? 'FAIL').toUpperCase();
    if (takeOn === 'OFF') return;
    if (takeOn === 'FAIL' && status === 'PASSED') return;

    // If step screenshots are enabled, skip scenario screenshots unless explicitly ALWAYS
    const stepShots = String(process.env.STEP_SCREENSHOTS ?? 'ON').toUpperCase();
    if (stepShots !== 'OFF' && takeOn !== 'ALWAYS') return;

    const safeName = safeFilePart(pickle?.name ?? 'scenario', 120);
    const filePath = path.join(SCREENSHOT_DIR, `${Date.now()}_${status}_${safeName}.png`);
    const buf = await this.page.screenshot({ path: filePath, fullPage: true });
    await this.attach(buf, 'image/png');
  } catch (e) {
    console.warn('[screenshots After] failed:', (e as Error).message);
  }
});

// Step screenshots (one per step, mapped via testStepId in message protocol)
AfterStep(async function (this: PlaywrightWorld, { pickleStep, result }: ITestStepHookParameter) {
  try {
    const enabled = String(process.env.STEP_SCREENSHOTS ?? 'ON').toUpperCase();
    if (enabled === 'OFF') return;

    // Skip hooks (hook steps have no pickleStep)
    if (!pickleStep) return;
    if (!this.page) return;
    if (typeof this.attach !== 'function') return;

    const status = String(result?.status ?? 'UNKNOWN').toUpperCase();
    const safe = safeFilePart(pickleStep.text ?? 'step', 80);
    const worker = process.env.CUCUMBER_WORKER_ID ?? String(process.pid);
    const filePath = path.join(STEP_SCREENSHOT_DIR, `${Date.now()}_w${worker}_${status}_${safe}.png`);

    const buf = await this.page.screenshot({ path: filePath, fullPage: true });
    await this.attach(buf, 'image/png');
  } catch {
    // ignore
  }
});