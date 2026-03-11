import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../src/pages/login.page';
import { DashboardPage } from '../../../src/pages/dashboard.page';

test.describe('Login Smoke Tests', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.goto();
    await loginPage.waitForLoginForm();
  });

  test('should log in successfully with valid credentials', async () => {
    const username = process.env.UI_USERNAME ?? '';
    const password = process.env.UI_PASSWORD ?? '';
    if (!username || !password) {
      throw new Error('UI_USERNAME and UI_PASSWORD must be set in the environment to run this test');
    }
    await loginPage.login(username, password);
    expect(await dashboardPage.isDashboardVisible()).toBeTruthy();
  });

  test('should show error message with invalid credentials', async () => {
    const invalidUser = 'invalid_user';
    const invalidPass = 'invalid_pass';
    await loginPage.login(invalidUser, invalidPass);
    expect(await loginPage.isLoginErrorVisible()).toBeTruthy();
  });
});