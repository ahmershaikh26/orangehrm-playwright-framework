import { Page, ElementHandle } from 'playwright';

export class ScreenshotUtil {
    static async captureScreenshot(page: Page, filePath: string): Promise<void> {
        await page.screenshot({ path: filePath });
    }

    static async captureFullPageScreenshot(page: Page, filePath: string): Promise<void> {
        await page.screenshot({ path: filePath, fullPage: true });
    }

    static async captureElementScreenshot(element: ElementHandle, filePath: string): Promise<void> {
        await element.screenshot({ path: filePath });
    }
}