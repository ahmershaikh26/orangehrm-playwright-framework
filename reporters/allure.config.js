module.exports = {
    allure: {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: false,
        useCucumberStepReporter: true,
    },
    reporter: [
        ['list'],
        ['allure-playwright'],
        ['junit', { outputFile: 'results.xml' }],
    ],
    retries: 2,
    timeout: 30000,
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
        {
            name: 'firefox',
            use: { browserName: 'firefox' },
        },
        {
            name: 'webkit',
            use: { browserName: 'webkit' },
        },
    ],
};