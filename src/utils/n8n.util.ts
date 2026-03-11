import https from 'https';
import http from 'http';

export interface N8nTestResultPayload {
  tags: string;
  total: number;
  passed: number;
  failed: number;
  reportDir: string;
  timestamp: string;
  jiraTickets: string[];
  failedScenarios?: string[];
  uiMode?: string;
  browser?: string;
}

export interface N8nFeatureRequestPayload {
  storyKey: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
}

export interface N8nWebhookResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export class N8nUtil {
  // ---------- Post test results to n8n ----------

  static async postTestResults(payload: N8nTestResultPayload): Promise<void> {
    const url = process.env.N8N_WEBHOOK_RESULTS;
    if (!url) {
      console.warn('[N8nUtil] N8N_WEBHOOK_RESULTS not set — skipping notification.');
      return;
    }

    try {
      await N8nUtil._post(url, payload);
      console.log(`[N8nUtil] Test results posted to n8n. passed=${payload.passed} failed=${payload.failed}`);
    } catch (e) {
      console.warn('[N8nUtil] Failed to notify n8n:', (e as Error).message);
    }
  }

  // ---------- Request feature file generation ----------

  static async requestFeatureGeneration(payload: N8nFeatureRequestPayload): Promise<N8nWebhookResponse> {
    const url = process.env.N8N_WEBHOOK_FEATURE_GEN;
    if (!url) throw new Error('[N8nUtil] N8N_WEBHOOK_FEATURE_GEN is not set.');

    const raw = await N8nUtil._post(url, payload);
    try {
      return JSON.parse(raw) as N8nWebhookResponse;
    } catch {
      return { success: true, message: raw };
    }
  }

  // ---------- Notify on failure (triggers Jira bug creation in n8n) ----------

  static async notifyFailure(opts: {
    scenarioName: string;
    featureName: string;
    error: string;
    screenshotBase64?: string;
    jiraStoryKey?: string;
    tags?: string[];
  }): Promise<void> {
    const url = process.env.N8N_WEBHOOK_FAILURE;
    if (!url) {
      console.warn('[N8nUtil] N8N_WEBHOOK_FAILURE not set — skipping failure notification.');
      return;
    }

    try {
      await N8nUtil._post(url, {
        ...opts,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? 'test',
        browser: process.env.BROWSER ?? 'chromium',
        uiMode: process.env.UI_MODE ?? 'desktop',
      });

      console.log(`[N8nUtil] Failure notification sent for: ${opts.scenarioName}`);
    } catch (e) {
      console.warn('[N8nUtil] Failed to send failure notification:', (e as Error).message);
    }
  }

  // ---------- Build result payload from cucumber.json ----------

  static buildResultPayload(
    cucumberJson: any[],
    opts: { tags: string; reportDir: string; uiMode?: string; browser?: string }
  ): N8nTestResultPayload {
    let total = 0;
    let failed = 0;
    const failedScenarios: string[] = [];

    for (const feature of cucumberJson) {
      for (const scenario of feature.elements ?? []) {
        total++;
        const hasFailed = (scenario.steps ?? []).some(
          (s: any) => s.result?.status === 'failed'
        );
        if (hasFailed) {
          failed++;
          failedScenarios.push(`[${feature.name}] ${scenario.name}`);
        }
      }
    }

    return {
      tags: opts.tags,
      total,
      passed: total - failed,
      failed,
      failedScenarios,
      reportDir: opts.reportDir,
      timestamp: new Date().toISOString(),
      jiraTickets: N8nUtil.extractJiraKeys(opts.tags),
      uiMode: opts.uiMode ?? process.env.UI_MODE ?? 'desktop',
      browser: opts.browser ?? process.env.BROWSER ?? 'chromium',
    };
  }

  // ---------- Extract Jira keys from tag expression ----------

  static extractJiraKeys(tags: string): string[] {
    return [...tags.matchAll(/[A-Z]+-\d+/g)].map((m) => m[0]);
  }

  // ---------- Private: HTTP POST ----------

  private static _post(url: string, payload: object): Promise<string> {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const body = JSON.stringify(payload);

      const req = lib.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            ...(process.env.N8N_WEBHOOK_SECRET
              ? { 'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET }
              : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`[N8nUtil] HTTP ${res.statusCode}: ${data}`));
            } else {
              resolve(data);
            }
          });
        }
      );

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}