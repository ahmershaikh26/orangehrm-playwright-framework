import fs from 'fs';
import path from 'path';
import { TestRailUtil } from '../utils/testrail.util';

async function globalTeardown() {
  if (process.env.TESTRAIL_API_KEY) {
    try {
      const runName = `Automated Run - ${new Date().toISOString().split('T')[0]}`;
      const results = readResultsFromFile();

      if (results.length === 0) {
        console.warn('[Teardown] No test results found to post to TestRail.');
        return;
      }

      const caseIds = results.map((r) => r.caseId);
      const runId = await TestRailUtil.createTestRun(runName, caseIds);

      await TestRailUtil.addResults(
        runId,
        results.map((r) => ({
          case_id: r.caseId,
          status_id: r.passed ? 1 : 5,
          comment: r.error ?? '',
          elapsed: `${Math.round(r.duration / 1000)}s`,
        }))
      );

      console.log(`[Teardown] ✅ TestRail results posted to run: ${runId}`);
    } catch (err) {
      console.warn('[Teardown] ⚠️ TestRail posting failed:', err);
    }
  }
}

interface TestResult {
  caseId: number;
  passed: boolean;
  duration: number;
  error: string | null;
}

function readResultsFromFile(): TestResult[] {
  const reportPath = path.resolve(
    process.cwd(),
    'playwright-report',
    'results.json'
  );

  if (!fs.existsSync(reportPath)) {
    console.warn(`[Teardown] Results file not found: ${reportPath}`);
    return [];
  }

  try {
    const raw = fs.readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(raw);
    const results: TestResult[] = [];

    for (const suite of report.suites ?? []) {
      for (const spec of suite.specs ?? []) {
        // Extract TestRail case ID from test title e.g. "[C123]"
        const match = spec.title.match(/\[C(\d+)\]/);
        if (!match) continue;

        const caseId = Number(match[1]);
        const passed = spec.tests?.every((t: any) =>
          t.results?.every((r: any) => r.status === 'passed')
        ) ?? false;

        const duration = spec.tests?.[0]?.results?.[0]?.duration ?? 0;
        const error = passed
          ? null
          : spec.tests?.[0]?.results?.[0]?.error?.message ?? 'Test failed';

        results.push({ caseId, passed, duration, error });
      }
    }

    return results;
  } catch (err) {
    console.warn('[Teardown] Failed to parse results file:', err);
    return [];
  }
}

export { globalTeardown };
export default globalTeardown;