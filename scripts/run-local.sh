#!/bin/bash

# Navigate to the project directory
cd "$(dirname "$0")/.."

# Install dependencies
npm install

# Run Playwright tests
npx playwright test

# Run Cucumber tests
npx cucumber-js

# Run API tests
npx ts-node src/api/client.ts

# Notify completion
echo "Local test execution completed."