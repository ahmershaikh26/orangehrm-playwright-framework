import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['dot'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'test-results/html' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['allure-playwright'],
  ],
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  retries: 2,
});