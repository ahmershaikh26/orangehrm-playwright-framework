import type { Page } from '@playwright/test';
import { InteractionUtil } from '../utils/interaction.util';

export class AdminPage {
  page: Page;
  I: InteractionUtil;

  selectors = {
    header: '//h6[contains(normalize-space(.),"User Management") or contains(normalize-space(.),"Admin")]',
    userManagementMenu: '//button[contains(normalize-space(.),"User Management") or //a[contains(normalize-space(.),"User Management")]]',
    jobMenu: '//button[contains(normalize-space(.),"Job")]',
    // direct link to System Users (users list)
    systemUsersLink: '//a[contains(normalize-space(.),"Users") or contains(normalize-space(.),"System Users")]',
    addButton: '//button[contains(normalize-space(.),"+ Add") or contains(normalize-space(.),"Add")]',
  };

  constructor(page: Page) {
    this.page = page;
    this.I = new InteractionUtil(page);
  }

  async goto(): Promise<void> {
    // rely on base URL already loaded; otherwise navigate to base
    await this.page.goto(process.env.BASE_URL || '/');
    await this.I.waitForNavigation();
  }

  async openUserManagement(): Promise<void> {
    // prefer clicking sidebar via left nav; fallback to in-page header menu
    await this.I.click(this.selectors.userManagementMenu);
    await this.I.waitForNavigation();
  }

  async openSystemUsers(): Promise<void> {
    await this.I.click(this.selectors.systemUsersLink);
    await this.I.waitForNavigation();
  }

  async clickAdd(): Promise<void> {
    await this.I.click(this.selectors.addButton);
  }

  async isOnAdminPage(): Promise<boolean> {
    return this.I.isVisible(this.selectors.header);
  }
}