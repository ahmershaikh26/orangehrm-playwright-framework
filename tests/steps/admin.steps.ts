import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { LeftNav } from '../../src/pages/left-nav.component';
import { AdminPage } from '../../src/pages/admin.page';
import { SystemUsersPage } from '../../src/pages/system-users.page';
import { AddUserPage } from '../../src/pages/add-user.page';

declare module '@cucumber/cucumber' {
  interface World {
    page: any;
    leftNav?: LeftNav;
    adminPage?: AdminPage;
    systemUsers?: SystemUsersPage;
    addUserPage?: AddUserPage;
  }
}

Given('I navigate to {string}', async function (label: string) {
  this.leftNav = this.leftNav || new LeftNav(this.page);
  await this.leftNav.navigateTo(label);
});

When('I open {string} > {string}', async function (parent: string, child: string) {
  this.leftNav = this.leftNav || new LeftNav(this.page);
  this.adminPage = this.adminPage || new AdminPage(this.page);

  if (parent.toLowerCase().includes('admin')) {
    await this.adminPage.openUserManagement();
    if (child && child.toLowerCase().includes('user')) {
      await this.adminPage.openSystemUsers();
    }
  } else {
    await this.leftNav.navigateTo(parent);
    if (child) await this.leftNav.navigateTo(child);
  }
});

When('I search users by username {string}', async function (username: string) {
  this.systemUsers = this.systemUsers || new SystemUsersPage(this.page);
  // support env token
  const actual = username === '<env>' ? (process.env.UI_USERNAME || username) : username;
  await this.systemUsers.searchByUsername(actual);
});

Then('the user list should contain {string}', async function (username: string) {
  this.systemUsers = this.systemUsers || new SystemUsersPage(this.page);
  const names = await this.systemUsers.getVisibleUsernames();
  const actual = username === '<env>' ? (process.env.UI_USERNAME || username) : username;
  expect(names.some((n: string) => n.includes(actual))).toBeTruthy();
});

When('I click {string}', async function (label: string) {
  if (label.toLowerCase() === 'add') {
    this.systemUsers = this.systemUsers || new SystemUsersPage(this.page);
    await this.systemUsers.clickAddUser();
    return;
  }
  // fallback generic click via left nav
  this.leftNav = this.leftNav || new LeftNav(this.page);
  await this.leftNav.navigateTo(label);
});

When('I select user role {string}', async function (role: string) {
  this.addUserPage = this.addUserPage || new AddUserPage(this.page);
  await this.addUserPage.selectUserRole(role);
});

When('I enter employee name {string}', async function (name: string) {
  this.addUserPage = this.addUserPage || new AddUserPage(this.page);
  await this.addUserPage.enterEmployeeName(name);
});

When('I enter username {string}', async function (username: string) {
  this.addUserPage = this.addUserPage || new AddUserPage(this.page);
  const actual = username === '<env>' ? (process.env.UI_USERNAME || username) : username;
  await this.addUserPage.enterUsername(actual);
});

When('I set status {string}', async function (status: string) {
  this.addUserPage = this.addUserPage || new AddUserPage(this.page);
  await this.addUserPage.selectStatus(status);
});

When('I set password {string}', async function (password: string) {
  this.addUserPage = this.addUserPage || new AddUserPage(this.page);
  const pass = password === '<env>' ? (process.env.UI_PASSWORD || password) : password;
  await this.addUserPage.enterPassword(pass);
});

When('I save the user', async function () {
  this.addUserPage = this.addUserPage || new AddUserPage(this.page);
  await this.addUserPage.save();
});

Then('the newly added user {string} should appear in the users list', async function (username: string) {
  this.systemUsers = this.systemUsers || new SystemUsersPage(this.page);
  const actual = username === '<env>' ? (process.env.UI_USERNAME || username) : username;
  await this.systemUsers.searchByUsername(actual);
  const names = await this.systemUsers.getVisibleUsernames();
  expect(names.some((n: string) => n.includes(actual))).toBeTruthy();
});