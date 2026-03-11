import type { Page, Locator } from '@playwright/test';

export class InteractionUtil {
  page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  locator(xpathOrSelector: string) {
    if (xpathOrSelector.startsWith('//') || xpathOrSelector.startsWith('(')) {
      return this.page.locator(`xpath=${xpathOrSelector}`);
    }
    return this.page.locator(xpathOrSelector);
  }

  async click(selector: string, options = {}) {
    const loc = this.locator(selector);
    await loc.waitFor({ state: 'visible', timeout: 8000 });
    await loc.click(options);
  }

  async type(selector: string, text: string, options = {}) {
    const loc = this.locator(selector);
    await loc.waitFor({ state: 'visible', timeout: 8000 });
    await loc.fill(text, options);
  }

  async getText(selector: string) {
    const loc = this.locator(selector);
    await loc.waitFor({ state: 'visible', timeout: 8000 });
    return loc.innerText();
  }

  async isVisible(selector: string) {
    const loc = this.locator(selector);
    return loc.isVisible();
  }

  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle');
  }
}