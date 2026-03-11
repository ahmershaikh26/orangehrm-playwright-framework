export class BasePage {
    protected page: any;

    constructor(page: any) {
        this.page = page;
    }

    async navigateTo(url: string) {
        await this.page.goto(url);
    }

    async click(selector: string) {
        await this.page.click(selector);
    }

    async fill(selector: string, text: string) {
        await this.page.fill(selector, text);
    }

    async getText(selector: string): Promise<string> {
        return await this.page.textContent(selector);
    }

    async isVisible(selector: string): Promise<boolean> {
        return await this.page.isVisible(selector);
    }

    async waitForSelector(selector: string) {
        await this.page.waitForSelector(selector);
    }

    async takeScreenshot(path: string) {
        await this.page.screenshot({ path });
    }
}