import { Page } from 'playwright';

export class VideoUtil {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // Playwright starts video recording when the BrowserContext is created with the recordVideo option,
    // so starting/stopping recording on the Video object is not needed; keep as no-ops.
    async startRecording(_videoPath: string) {
        return;
    }

    async stopRecording() {
        return;
    }

    async saveVideo(videoPath: string) {
        const video = this.page.video();
        if (video) {
            // Use Playwright's Video.saveAs to persist the recorded video.
            await video.saveAs(videoPath);
        }
    }

    async getVideoPath(): Promise<string | null> {
        const video = this.page.video();
        return video ? await video.path() : null;
    }
}