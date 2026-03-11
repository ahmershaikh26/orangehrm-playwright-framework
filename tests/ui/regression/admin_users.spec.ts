import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../src/pages/login.page';
import { DashboardPage } from '../../../src/pages/dashboard.page';
import { LeftNav } from '../../../src/pages/left-nav.component';
import { AdminPage } from '../../../src/pages/admin.page';
import { SystemUsersPage } from '../../../src/pages/system-users.page';
import { AddUserPage } from '../../../src/pages/add-user.page';

test.describe('Admin / System Users - regression', () => {
  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    // use env creds (UI_USERNAME/UI_PASSWORD) or fall back to defaults in fixtures
    await login.loginWithEnvCredentials();
    await page.waitForLoadState('networkidle');
  });

  test('Open Admin -> User Management -> System Users list', async ({ page }) => {
    const left = new LeftNav(page);
    await left.navigateTo('Admin');
    const admin = new AdminPage(page);
    await admin.openUserManagement();
    await admin.openSystemUsers();
    const sys = new SystemUsersPage(page);
    const names = await sys.getVisibleUsernames();
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  test('Search for an existing user (uses UI_USERNAME env when <env> in example)', async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.openUserManagement();
    await admin.openSystemUsers();
    const sys = new SystemUsersPage(page);
    const username = process.env.SEARCH_USERNAME || process.env.UI_USERNAME || 'Admin';
    await sys.searchByUsername(username);
    const names = await sys.getVisibleUsernames();
    expect(names.some(n => n.includes(username))).toBeTruthy();
  });

  test('Add a new user (quick smoke)', async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.openUserManagement();
    await admin.openSystemUsers();
    const sys = new SystemUsersPage(page);
    await sys.clickAddUser();

    const add = new AddUserPage(page);
    const unique = `e2e_${Date.now()}`;
    const username = process.env.NEW_USER_USERNAME || `user_${unique}`;
    const employee = process.env.NEW_USER_EMPLOYEE || 'Jobin Sam';
    const password = process.env.NEW_USER_PASSWORD || (process.env.UI_PASSWORD || 'Passw0rd!');

    await add.selectUserRole('ESS');
    await add.enterEmployeeName(employee);
    await add.enterUsername(username);
    await add.selectStatus('Enabled');
    await add.enterPassword(password);
    await add.save();

    // verify new user added
    await sys.searchByUsername(username);
    const names = await sys.getVisibleUsernames();
    expect(names.some(n => n.includes(username))).toBeTruthy();
  });
});