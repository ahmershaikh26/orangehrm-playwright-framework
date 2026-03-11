import type { Page } from '@playwright/test';
import { InteractionUtil } from '../utils/interaction.util';

export class SystemUsersPage {
  page: Page;
  I: InteractionUtil;

  selectors = {
    usernameFilter: '//label[contains(.,"Username")]/following::input[1] | //input[@placeholder="Username" or @name="username"]',
    userRoleSelect: '//label[contains(.,"User Role")]/following::div[contains(@class,"select")][1] | //div[contains(@class,"oxd-select-text")]',
    employeeNameFilter: '//label[contains(.,"Employee Name")]/following::input[1] | //input[@placeholder="Type for hints..."]',
    statusSelect: '//label[contains(.,"Status")]/following::div[contains(@class,"select")][1]',
    searchButton: '//button[normalize-space()="Search" or contains(normalize-space(.),"Search")]',
    resetButton: '//button[normalize-space()="Reset" or contains(normalize-space(.),"Reset")]',
    addButton: '//button[contains(normalize-space(.),"+ Add") or contains(normalize-space(.),"Add")]',
    tableRows: '//div[contains(@class,"oxd-table-body")]//div[contains(@role,"row")]',
    rowByUsername: (username: string) => `//div[contains(@class,"oxd-table-body")]//div[contains(@role,"row")]//div[normalize-space(.)="${username}"]/ancestor::div[contains(@role,"row")]`,
    editButtonInRow: (username: string) => `${(username ? `//div[normalize-space()="${username}"]/ancestor::div[contains(@role,"row")]` : '')}//button[contains(@aria-label,"Edit") or contains(@class,"edit")]`,
    deleteButtonInRow: (username: string) => `${(username ? `//div[normalize-space()="${username}"]/ancestor::div[contains(@role,"row")]` : '')}//button[contains(@aria-label,"Delete") or contains(@class,"delete")]`,
  };

  constructor(page: Page) {
    this.page = page;
    this.I = new InteractionUtil(page);
  }

  async searchByUsername(username: string): Promise<void> {
    await this.I.type(this.selectors.usernameFilter, username);
    await this.I.click(this.selectors.searchButton);
    await this.page.waitForTimeout(300);
  }

  async clickAddUser(): Promise<void> {
    await this.I.click(this.selectors.addButton);
  }

  async getVisibleUsernames(): Promise<string[]> {
    const rows = this.page.locator(this.selectors.tableRows);
    const count = await rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      // Username is usually the first or second cell; attempt to read meaningful text
      const row = rows.nth(i);
      const cell = row.locator('div').nth(1); // best-effort
      const text = (await cell.innerText()).trim();
      if (text) names.push(text);
    }
    return names;
  }

  async editUser(username: string): Promise<void> {
    const locator = this.selectors.editButtonInRow(username);
    await this.I.click(locator);
    await this.I.waitForNavigation();
  }

  async deleteUser(username: string): Promise<void> {
    const locator = this.selectors.deleteButtonInRow(username);
    await this.I.click(locator);
    // assume confirm dialog - try OK button
    const confirmBtn = '//button[normalize-space()="Yes" or normalize-space()="Ok" or normalize-space()="Delete"]';
    if (await this.I.isVisible(confirmBtn)) {
      await this.I.click(confirmBtn);
    }
    await this.I.waitForNavigation();
  }
}