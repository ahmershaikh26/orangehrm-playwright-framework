import type { Page } from '@playwright/test';
import { InteractionUtil } from '../utils/interaction.util';

export class LeftNav {
  page: Page;
  I: InteractionUtil;
  selectors = {
    // Generic left nav item (matches label text)
    navItemByText: (text: string) => `//nav//a//*[contains(normalize-space(.),"${text}")]\n | //aside//a[.//*[contains(normalize-space(.),"${text}")]]\n | //a[normalize-space()="${text}"]`,
    // Collapsed hamburger toggle (if present)
    collapseToggle: '//button[contains(@class,"sidebar-toggle") or contains(@aria-label,"toggle")]',
  };

  constructor(page: Page) {
    this.page = page;
    this.I = new InteractionUtil(page);
  }

  async navigateTo(label: string): Promise<void> {
    const locator = this.selectors.navItemByText(label);
    await this.I.click(locator);
    await this.I.waitForNavigation();
  }

  async collapseIfPresent(): Promise<void> {
    try {
      if (await this.I.isVisible(this.selectors.collapseToggle)) {
        await this.I.click(this.selectors.collapseToggle);
      }
    } catch {}
  }
}