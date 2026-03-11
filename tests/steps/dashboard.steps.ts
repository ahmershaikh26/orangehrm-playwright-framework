import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { DashboardPage } from '../../src/pages/dashboard.page';
import { LoginPage } from '../../src/pages/login.page';

declare module '@cucumber/cucumber' {
  interface World {
    page: any;
    dashboardPage?: DashboardPage;
    loginPage?: LoginPage;
  }
}

When('I navigate to the dashboard', async function () {
  // assume already logged in; otherwise log in via env
  this.dashboardPage = this.dashboardPage || new DashboardPage(this.page);
  await this.page.goto(process.env.BASE_URL || '/');
  await this.page.waitForLoadState('networkidle');
});

Then('the dashboard should be visible', async function () {
  this.dashboardPage = this.dashboardPage || new DashboardPage(this.page);
  const visible = await this.dashboardPage.isDashboardVisible();
  expect(visible).toBeTruthy();
});

Then('the {string} widget should be visible', async function (widgetTitle: string) {
  // generic widget visibility check by title text
  const locator = `//div[contains(normalize-space(.),"${widgetTitle}")] | //h4[contains(normalize-space(.),"${widgetTitle}")] | //h3[contains(normalize-space(.),"${widgetTitle}")]`;
  const isVisible = await this.page.locator(locator).first().isVisible().catch(() => false);
  expect(isVisible).toBeTruthy();
});