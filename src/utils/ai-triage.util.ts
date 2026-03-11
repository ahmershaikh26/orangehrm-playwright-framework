import fs from 'fs';
import path from 'path';
import { AIUtil } from './ai.util';

type PlaywrightResult = any;

export class AITriage {

  // ---------- Triage from Playwright JSON report ----------

  static async summarizeFailures(reportPath?: string): Promise<string> {
    const file = reportPath || path.resolve('artifacts', 'playwright-report.json');
    if (!fs.existsSync(file)) throw new Error(`Playwright JSON report not found: ${file}`);

    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as PlaywrightResult;
    const failures: { title: string; test: string; error: string }[] = [];

    for (const entry of raw.suites || []) {
      const collect = (node: any, parent = '') => {
        const name = parent ? `${parent} / ${node.title}` : node.title || '';
        if (node.tests) {
          for (const t of node.tests) {
            if (t.status === 'failed') {
              failures.push({
                title: name,
                test: t.title,
                error:
                  (t.results && t.results[0] && t.results[0].error) ||
                  JSON.stringify(t.results || t.error || ''),
              });
            }
          }
        }
        if (node.suites) for (const s of node.suites) collect(s, name);
      };
      collect(entry);
    }

    if (failures.length === 0) return 'No failures found in Playwright JSON report.';

    const result = await AIUtil.triageFailures(failures);
    return JSON.stringify(result, null, 2);
  }

  // ---------- Triage from Cucumber JSON report ----------

  static async summarizeCucumberFailures(cucumberJsonPath?: string): Promise<string> {
    const file = cucumberJsonPath || path.resolve('artifacts', 'cucumber.json');
    if (!fs.existsSync(file)) throw new Error(`Cucumber JSON report not found: ${file}`);

    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const failures: { title: string; test: string; error: string }[] = [];

    for (const feature of raw) {
      for (const scenario of feature.elements ?? []) {
        for (const step of scenario.steps ?? []) {
          if (step.result?.status === 'failed') {
            failures.push({
              title: feature.name,
              test: scenario.name,
              error: step.result?.error_message ?? 'Unknown error',
            });
            break; // one entry per scenario
          }
        }
      }
    }

    if (failures.length === 0) return 'No failures found in Cucumber JSON report.';

    const result = await AIUtil.triageFailures(failures);
    return JSON.stringify(result, null, 2);
  }
}