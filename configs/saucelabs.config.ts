import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
    retries: 2,
    use: {
        // Configure the browser to use Sauce Labs
        browserName: 'chromium',
        launchOptions: {
            headless: true,
        },
        // Set the Sauce Labs credentials
        trace: 'on-first-retry',
        video: 'on',
        screenshot: 'on',
    },
    projects: [
        {
            name: 'Chrome on Sauce Labs',
            use: {
                // Sauce Labs configuration
                browserName: 'chrome' as any,
                // Add Sauce Labs capabilities
                ...{
                    'sauce:options': {
                        username: process.env.SAUCE_USERNAME,
                        accessKey: process.env.SAUCE_ACCESS_KEY,
                        build: process.env.BUILD_ID,
                        name: 'Playwright Tests',
                        platformName: 'Windows 10',
                        browserVersion: 'latest',
                    },
                },
            },
        },
        {
            name: 'Firefox on Sauce Labs',
            use: {
                browserName: 'firefox',
                ...{
                    'sauce:options': {
                        username: process.env.SAUCE_USERNAME,
                        accessKey: process.env.SAUCE_ACCESS_KEY,
                        build: process.env.BUILD_ID,
                        name: 'Playwright Tests',
                        platformName: 'Windows 10',
                        browserVersion: 'latest',
                    },
                },
            },
        },
    ],
};

export default config;