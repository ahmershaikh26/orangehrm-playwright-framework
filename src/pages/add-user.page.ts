import type { Page } from '@playwright/test';
import { InteractionUtil } from '../utils/interaction.util';

export class AddUserPage {
  page: Page;
  I: InteractionUtil;

  selectors = {
    userRoleDropdown: '//label[contains(.,"User Role")]/following::div[contains(@class,"oxd-select-text")][1] | //div[@role="listbox" and contains(@class,"oxd-select-text")]',
    userRoleOption: (role: string) => `//div[contains(@role,"option") and contains(normalize-space(.),"${role}")]`,
    employeeNameInput: '//input[@placeholder="Type for hints..." or contains(@placeholder,"Type for hints")]',
    employeeSuggestionItem: (namePart: string) => `//div[contains(@role,"option") and contains(normalize-space(.),"${namePart}")]`,
    usernameInput: '//label[contains(.,"Username")]/following::input[1] | //input[@name="username"]',
    statusDropdown: '//label[contains(.,"Status")]/following::div[contains(@class,"oxd-select-text")][1]',
    statusOption: (status: string) => `//div[contains(@role,"option") and contains(normalize-space(.),"${status}")]`,
    passwordInput: '//input[@type="password" and contains(@placeholder,"Password")] | //input[@name="password"]',
    confirmPasswordInput: '//input[@type="password" and (contains(@placeholder,"Confirm") or contains(@name,"confirm"))]',
    saveButton: '//button[normalize-space()="Save" or contains(normalize-space(.),"Save")]',
    cancelButton: '//button[normalize-space()="Cancel" or contains(normalize-space(.),"Cancel")]',
    requiredFieldError: '//span[contains(@class,"oxd-input-field-error") or contains(.,"Required")]',
  };

  constructor(page: Page) {
    this.page = page;
    this.I = new InteractionUtil(page);
  }

  async selectUserRole(role: string): Promise<void> {
    await this.I.click(this.selectors.userRoleDropdown);
    await this.I.click(this.selectors.userRoleOption(role));
  }

  async enterEmployeeName(name: string): Promise<void> {
    await this.I.type(this.selectors.employeeNameInput, name);
    // wait then choose suggestion
    const suggestion = this.selectors.employeeSuggestionItem(name.split(' ')[0]);
    if (await this.I.isVisible(suggestion)) {
      await this.I.click(suggestion);
    }
  }

  async enterUsername(username: string): Promise<void> {
    await this.I.type(this.selectors.usernameInput, username);
  }

  async selectStatus(status: string): Promise<void> {
    await this.I.click(this.selectors.statusDropdown);
    await this.I.click(this.selectors.statusOption(status));
  }

  async enterPassword(password: string): Promise<void> {
    await this.I.type(this.selectors.passwordInput, password);
    await this.I.type(this.selectors.confirmPasswordInput, password);
  }

  async save(): Promise<void> {
    await this.I.click(this.selectors.saveButton);
    await this.I.waitForNavigation();
  }

  async cancel(): Promise<void> {
    await this.I.click(this.selectors.cancelButton);
    await this.I.waitForNavigation();
  }

  async hasRequiredFieldErrors(): Promise<boolean> {
    return this.I.isVisible(this.selectors.requiredFieldError);
  }
}