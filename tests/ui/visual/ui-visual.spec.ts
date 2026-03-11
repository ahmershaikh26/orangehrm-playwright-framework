import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { VisualUtil } from '../../../src/utils/visual.util';

test.describe('Visual Regression Tests', () => {
  const baselineName = process.env.VISUAL_BASELINE_NAME || 'login-page';
  const tolerance = Number(process.env.VISUAL_TOLERANCE || '0.1');

  test('UI should match the baseline', async ({ page }) => {
    // Navigate to application under test using env-driven base URL
    await page.goto(process.env.BASE_URL || '/');
    await page.waitForLoadState('networkidle');

    const baselineDir = path.resolve('artifacts', 'visual', 'baseline');
    const baselinePath = path.join(baselineDir, `${baselineName}.png`);

    // If baseline missing, create it and fail the test so baseline can be reviewed
    if (!fs.existsSync(baselinePath)) {
      await VisualUtil.saveBaseline(page, baselineName);
      throw new Error(`Baseline image created at ${baselinePath}. Review and re-run tests to perform comparisons.`);
    }

    // Compare current UI with baseline
    const result = await VisualUtil.compareWithBaseline(page, baselineName, tolerance);

    // If comparison fails, provide diff path in assertion message
    expect(result.isWithinTolerance, `Visual diff ${result.diffPercent}% exceeds tolerance ${tolerance}%. Diff saved at ${result.diffPath}`).toBeTruthy();
  });
});