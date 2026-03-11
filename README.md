# OrangeHRM Playwright E2E Framework

Purpose
-------
A maintainable, extensible end-to-end test framework for OrangeHRM that combines:
- Playwright for fast, reliable browser automation
- Cucumber (Gherkin) for readable BDD specifications
- Playwright Test for focused UI smoke/regression suites
- API tests for service-level validation
- Visual regression (pixel-diff) utilities
- Fixtures and utilities for Excel, Figma, and AI-assisted triage & test data generation

This repository is designed to:
- Provide clear page objects and step definitions for team consumption
- Support both UI and API-level validation
- Integrate optional AI helpers for triage, suggestions, and synthetic data generation
- Produce artifacts (screenshots, videos, reports) for CI debugging

Table of Contents
-----------------
- Prerequisites
- Installation
- Configuration (.env)
- Key commands
- Running tests (UI / Cucumber / API / Visual)
- Visual baseline workflow
- AI integration (what it does and how to use)
- Figma integration (fetch & compare designs)
- Artifacts and reports
- Troubleshooting
- Project structure
- Contributing & License

Prerequisites
-------------
- macOS (instructions assume macOS)
- Node.js (LTS recommended, e.g. >= 16 or 18)
- npm (bundled with Node)
- Network access to the AUT (BASE_URL), API endpoints, Figma, and OpenAI if used

Install system/browser dependencies
- Install node modules:
  - npm install
- Install Playwright browsers:
  - npx playwright install

Configuration (.env)
--------------------
Create a `.env` at project root or export env vars. Example keys used by the framework:

- BASE_URL=http://localhost:3000           # App under test
- API_BASE_URL=https://api.example.com     # Optional API base if apiClient uses it
- UI_USERNAME=Admin
- UI_PASSWORD=admin123
- API_USERNAME=api_user
- API_PASSWORD=api_pass
- BROWSER=chromium                         # chromium | firefox | webkit
- HEADLESS=true                            # "false" to run headed
- RECORD_VIDEO=false                       # "true" to record videos into artifacts/videos
- VISUAL_BASELINE_NAME=login-page
- VISUAL_TOLERANCE=0.1                     # percent tolerance for visual diffs
- OPENAI_API_KEY=                           # optional: for AI features
- OPENAI_MODEL=gpt-4o-mini                 # optional: AI model
- FIGMA_TOKEN=                              # optional: Figma API token
- SEARCH_USERNAME=                          # optional: used in regression tests
- NEW_USER_USERNAME=                         # optional used by regression add-user test

Important: never commit secrets to VCS. Use CI secret management for pipeline runs.

Install & Setup (Mac)
---------------------
1. Install dependencies:
   - npm install
2. Install Playwright browsers:
   - npx playwright install
3. (Optional) Install global tools (if desired):
   - npm i -g ts-node

Key npm scripts (examples — adjust package.json if different)
- Run Playwright Test (all): npx playwright test
- Run Playwright Test and produce JSON report:
  - npm run test:json
- Run only UI smoke tests:
  - npx playwright test tests/ui/smoke
- Run Cucumber features:
  - npx cucumber-js --require-module ts-node/register tests/features --require tests/steps/**/*.ts
  - (or) npm run cucumber (if present)
- Run AI triage (requires Playwright json reporter and OPENAI_API_KEY):
  - npm run test:json
  - npm run triage

Running tests (detailed)
-----------------------
UI tests (Playwright):
- Execute all Playwright tests:
  - npx playwright test
- Run a single file:
  - npx playwright test tests/ui/smoke/login.spec.ts
- Run in headed mode:
  - BROWSER=chromium HEADLESS=false npx playwright test --project=chromium

Cucumber (BDD) features:
- Run all features:
  - npx cucumber-js --require-module ts-node/register tests/features --require tests/steps/**/*.ts
- Filter by tag:
  - npx cucumber-js --tags "@smoke and @desktop" --require-module ts-node/register tests/features --require tests/steps/**/*.ts

API tests (Playwright or custom client):
- npx playwright test tests/api

Visual tests:
- Create baseline (first run): set VISUAL_BASELINE_NAME then run visual spec or allow suite to auto-create baseline.
- Compare current run against baseline:
  - npx playwright test tests/ui/visual/ui-visual.spec.ts
- If baseline missing, test will write baseline and fail intentionally so a human can review the saved baseline.

AI integration (what & how)
---------------------------
Included utilities:
- src/utils/ai.util.ts — lightweight wrapper to call OpenAI (completion) for:
  - test-data generation
  - selector suggestions
  - short triage prompts
  - NOTE: calls require OPENAI_API_KEY in .env

- src/utils/ai-triage.util.ts + scripts/triage.ts — post-test triage:
  - Generate Playwright json report: npm run test:json
  - Run triage: npm run triage
  - Output: prioritized hypotheses and suggested fixes

Recommended use-cases:
- Auto-generate synthetic test data for edge-case scenarios
- Feed failing tests into AI triage for root-cause hints and suggested patches
- Generate alternative selectors from a failing DOM snippet

Figma integration
-----------------
Utilities:
- src/utils/figma.util.ts — fetch Figma file, render images for component nodes, cache under artifacts/figma-cache, compare Figma designs vs runtime screenshots using resemblejs.
- Usage:
  - Set FIGMA_TOKEN in .env
  - Call FigmaUtil.fetchFigmaDesign(fileId)
  - Use VisualUtil.compareWithBaseline or FigmaUtil.compareDesigns to validate

Artifacts and report locations
-----------------------------
- artifacts/videos/            — recorded videos (when enabled)
- artifacts/screenshots/       — test-run screenshots saved manually in tests
- artifacts/visual/baseline/   — golden images for visual tests
- artifacts/visual/current/    — screenshots and diffs on each run
- artifacts/figma-cache/       — cached images fetched from Figma
- artifacts/playwright-report.json — JSON reporter output if using --reporter=json

Recommended CI flow
-------------------
1. Checkout repository
2. npm ci
3. npx playwright install --with-deps
4. Run API smoke / unit tests in parallel
5. Run Playwright UI tests (headless) with tag filters (smoke/regression)
6. Save artifacts (screenshots, videos, JSON report) and upload to build artifacts
7. Optionally run npm run triage to produce AI-summarized failure hints (requires OPENAI key stored securely)

Troubleshooting
---------------
- "zsh: command not found: #": means a comment line with `#` was pasted into the terminal; remove it.
- Playwright browsers not installed: run npx playwright install
- resemblejs issues (native libs): ensure Node canvas dependencies are installed or prefer running CI in a container image with canvas libs, or use Playwright screenshot diffing utilities instead.
- Missing .env values: many tests will throw if required creds are missing; set UI_USERNAME/UI_PASSWORD.

Project structure (high level)
------------------------------
- src/
  - pages/                      — Page Objects (login.page.ts, dashboard.page.ts, admin.page.ts, etc.)
  - utils/                      — utilities (visual, figma, excel, ai, interaction)
  - api/                        — api client and endpoints
  - fixtures/                    — test data, users
- tests/
  - features/                   — Cucumber feature files
  - steps/                      — Cucumber step definitions
  - ui/                         — Playwright UI test specs grouped by smoke/regression/visual
  - api/                        — API tests (Playwright or HTTP client)
- scripts/
  - triage.ts                   — CLI to run AI triage over playwright JSON report
- artifacts/                     — runtime outputs (generated during runs)

Best practices & suggestions
----------------------------
- Keep selectors resilient: prefer data-attributes when available; InteractionUtil centralizes waits and robust clicks.
- Use environment-driven credentials and avoid hardcoding secrets.
- Use tags (e.g., @smoke, @regression, @api, @ui, @desktop, @mobile) to selectively run suites in CI.
- Create/approve visual baselines on a controlled CI environment (consistent viewport, fonts, OS) to avoid spurious diffs.
- Use AI triage for preliminary investigation, but validate recommendations before applying automated fixes.

Contributing
------------
- Follow existing coding patterns (page objects, InteractionUtil usage)
- Add new features behind feature flags or new tags
- Add tests for utilities (excel, figma, ai) where network calls are stubbed or mocked
- Run linters and TypeScript compiler before opening PR:
  - npm run lint
  - npm run build (if configured)
