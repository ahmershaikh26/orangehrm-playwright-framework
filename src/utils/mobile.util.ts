import type { Page } from '@playwright/test';

export class MobileUtil {
    static async isMobileViewport(page: Page): Promise<void> {
        await page.setViewportSize({ width: 375, height: 667 }); // iPhone 6/7/8
    }

    static async navigateToMobileUrl(page: Page, url: string): Promise<void> {
        await page.goto(url, { waitUntil: 'networkidle' });
    }

    static async clickElementByXPath(page: Page, xpath: string): Promise<void> {
        const locator = page.locator(`xpath=${xpath}`);
        const count = await locator.count();
        if (count > 0) {
            await locator.first().click();
        } else {
            throw new Error(`Element not found for XPath: ${xpath}`);
        }
    }
    static async enterTextByXPath(page: Page, xpath: string, text: string): Promise<void> {
        const locator = page.locator(`xpath=${xpath}`);
        const count = await locator.count();
        if (count > 0) {
            await locator.first().fill(text);
        } else {
            throw new Error(`Element not found for XPath: ${xpath}`);
        }
    }
    static async getTextByXPath(page: Page, xpath: string): Promise<string> {
        const locator = page.locator(`xpath=${xpath}`);
        const count = await locator.count();
        if (count > 0) {
            return await locator.first().innerText();
        } else {
            throw new Error(`Element not found for XPath: ${xpath}`);
        }
    }
}