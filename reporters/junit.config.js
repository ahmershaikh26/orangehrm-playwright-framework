module.exports = {
    "reporter": [
        ["junit", {
            "outputFile": "test-results/results.xml",
            "suiteTitle": false,
            "includeConsoleLog": true
        }]
    ],
    "timeout": 30000,
    "retries": {
        "run": 2,
        "open": 0
    },
    "trace": "on-first-retry",
    "use": {
        "video": "retain-on-failure",
        "screenshot": "only-on-failure",
        "headless": true,
        "browserName": "chromium"
    }
};