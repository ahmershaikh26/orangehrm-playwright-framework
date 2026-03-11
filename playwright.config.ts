import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  retries: 1, // flaky control: retries
  reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'results/junit.xml' }]],
  outputDir: 'artifacts/playwright',
  use: {
    headless: process.env.HEADLESS === 'true',
    baseURL: process.env.BASE_URL,
    screenshot: 'only-on-failure',    // capture screenshots on failure
    video: 'on-first-retry',         // keep videos for failed/retried tests
    trace: 'retain-on-failure',      // save trace only if a test fails
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // mobile-web example
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});