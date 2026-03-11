import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  timeout: 30000,
  retries: 2,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['html', { open: 'never' }],
    ['allure-playwright'],
  ],
  use: {
    trace: 'on-first-retry',
    video: 'on',
    screenshot: 'on',
    headless: false,
    ignoreHTTPSErrors: true,
    actionTimeout: 0,
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    launchOptions: {
      slowMo: 50,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});