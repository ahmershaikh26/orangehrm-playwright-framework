module.exports = {
    default: {
        require: [
            'ts-node/register',
            'tests/steps/**/*.steps.ts'
        ],
        format: ['progress', 'json:reports/cucumber_report.json'],
        timeout: 60000,
        tags: '@smoke', // Change this to run specific tags
        'gherkin-parse-options': {
            // Options for parsing Gherkin files
            language: 'en'
        },
        // Additional options can be added here
    }
};