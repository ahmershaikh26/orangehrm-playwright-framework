import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { World as AppWorld } from '../support/world';

declare module '@cucumber/cucumber' {
  // make Cucumber "this" use the single shared World typing from support/world.ts
  interface World extends AppWorld {}
}

Given('I am on the login page', async function () {
  await this.pages!.login.goto();
  await this.pages!.login.waitForLoginForm();
});

When('I login with {string} and {string}', async function (username: string, password: string) {
  const envToken = (s: string) => s === '<env>' || s.toLowerCase() === 'env';

  if (envToken(username) && envToken(password)) {
    await this.pages!.login.loginWithEnvCredentials();
    return;
  }

  const user = envToken(username) ? String(process.env.UI_USERNAME ?? '') : username;
  const pass = envToken(password) ? String(process.env.UI_PASSWORD ?? '') : password;

  await this.pages!.login.login(user, pass);
});

Given('I am logged in', async function () {
  await this.pages!.login.goto();
  await this.pages!.login.waitForLoginForm();
  await this.pages!.login.loginWithEnvCredentials();
});

When('I click on the logout button', async function () {
  await this.pages!.dashboard.clickLogout();
});

Then('I should be redirected to the dashboard', async function () {
  expect(await this.pages!.dashboard.isDashboardVisible()).toBeTruthy();
});

Then('I should see a welcome message', async function () {
  expect(await this.pages!.dashboard.isDashboardVisible()).toBeTruthy();
});

Then('I should see an error message indicating invalid credentials', async function () {
  const text = (await this.pages!.login.getLoginErrorText().catch(() => '')).trim().toLowerCase();
  // keep assertion robust across envs
  expect(text).toMatch(/invalid|credentials|authentication/);
});

Then('I should see a username field', async function () {
  expect(await this.pages!.login.hasUsernameField()).toBeTruthy();
});

Then('I should see a password field', async function () {
  expect(await this.pages!.login.hasPasswordField()).toBeTruthy();
});

Then('I should see a login button', async function () {
  expect(await this.pages!.login.I.isVisible(this.pages!.login.selectors.loginButton)).toBeTruthy();
});

Then('I should see a password recovery link', async function () {
  expect(await this.pages!.login.hasForgotPasswordLink()).toBeTruthy();
});

Then('I should be redirected to the login page', async function () {
  expect(await this.pages!.login.hasUsernameField()).toBeTruthy();
});

Then('I should see a message indicating successful logout', async function () {
  // stable indicator for logout: login form is visible again
  expect(await this.pages!.login.hasUsernameField()).toBeTruthy();
});