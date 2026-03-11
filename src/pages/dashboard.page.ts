import type { Page } from '@playwright/test';
import { InteractionUtil } from '../utils/interaction.util';
import { waitForCondition } from '../utils/wait.util';

export class DashboardPage {
  page: Page;
  I: InteractionUtil;

  selectors = {
    dashboardHeader: '//h6[contains(normalize-space(.),"Dashboard")]',
    userProfileButton: '//p[contains(@class,"oxd-userdropdown-name")] | //button[contains(@class,"oxd-userdropdown")]',
    profileMenuLocator: '//div[contains(@class,"oxd-userdropdown")]',
    logoutButton: '//a[normalize-space()="Logout"] | //button[normalize-space()="Logout"] | //div[contains(.,"Logout")]',
  };

  constructor(page: Page) {
    this.page = page;
    this.I = new InteractionUtil(page);
  }

 async isDashboardVisible(): Promise<boolean> {
     const selector = this.selectors.dashboardHeader;
     const visible = await waitForCondition(async () => {
       try {
         return await this.I.isVisible(selector);
       } catch {
         return false;
       }
     }, 10_000, 250);
 
     return Boolean(visible);
   }
 

  async openUserProfileMenu(): Promise<void> {
    await this.I.click(this.selectors.userProfileButton);
    // small wait to allow menu to appear
    await this.page.waitForTimeout(250);
  }

  async clickLogout(): Promise<void> {
    await this.openUserProfileMenu();
    await this.I.click(this.selectors.logoutButton);
    await this.I.waitForNavigation();
  }

  // convenience: open profile then check if logout is visible
  async isLogoutVisible(): Promise<boolean> {
    await this.openUserProfileMenu();
    return this.I.isVisible(this.selectors.logoutButton);
  }
}