#!/bin/bash

# This script is used to run Playwright tests on Sauce Labs.

# Load environment variables from .env file
source ../configs/env/.env.example

# Set Sauce Labs credentials
SAUCE_USERNAME=$SAUCE_USERNAME
SAUCE_ACCESS_KEY=$SAUCE_ACCESS_KEY

# Define the test command
TEST_COMMAND="npx playwright test --config=../configs/playwright.config.ts"

# Run tests on Sauce Labs
echo "Running tests on Sauce Labs..."
$TEST_COMMAND --project=SauceLabs --headed --trace onRetry --retry 2

echo "Tests completed."