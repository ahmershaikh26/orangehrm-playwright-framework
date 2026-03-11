import { Page, Locator } from '@playwright/test';

export class HeaderComponent {
    private page: Page;
    private headerLocator: string;

    constructor(page: Page) {
        this.page = page;
        this.headerLocator = '//header';
    }

    getLogo(): Locator {
        return this.page.locator(this.headerLocator + '//img[@class="logo"]');
    }

    getNavigationLinks(): Locator {
        return this.page.locator(this.headerLocator + '//nav//a');
    }

    async clickLink(linkText: string) {
        const link = this.page.locator(this.headerLocator + `//nav//a[text()="${linkText}"]`);
        await link.click();
    }

    async isSearchVisible(): Promise<boolean> {
        return await this.page.locator(this.headerLocator + '//input[@type="search"]').isVisible();
    }
}