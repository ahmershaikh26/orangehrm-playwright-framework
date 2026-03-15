import https from 'https';

interface ZephyrTestCase {
  name: string;
  objective?: string;
  precondition?: string;
  status?: string;
  priority?: string;
  labels?: string[];
  folder?: string;
}

interface ZephyrTestResult {
  testCaseKey: string;
  statusName: 'Pass' | 'Fail' | 'Blocked' | 'Not Executed';
  comment?: string;
  executionTime?: number;
}

export class ZephyrUtil {

  private static get baseUrl(): string {
    return process.env.ZEPHYR_BASE_URL ?? 'https://api.zephyrscale.smartbear.com/v2';
  }

  private static get token(): string {
    const t = process.env.ZEPHYR_API_TOKEN;
    if (!t) throw new Error('[ZephyrUtil] ZEPHYR_API_TOKEN is not set.');
    return t;
  }

  private static get projectKey(): string {
    return process.env.ZEPHYR_PROJECT_KEY ?? process.env.JIRA_PROJECT_KEY ?? 'ORNG';
  }

  // ---------- Create Test Case ----------

  static async createTestCase(opts: ZephyrTestCase): Promise<string> {
    const body = JSON.stringify({
      projectKey: ZephyrUtil.projectKey,
      name: opts.name,
      objective: opts.objective ?? '',
      precondition: opts.precondition ?? '',
      status: opts.status ?? 'Draft',
      priority: { name: opts.priority ?? 'Normal' },
      labels: opts.labels ?? [],
    });

    const response = await ZephyrUtil._post('/testcases', body);
    const json = JSON.parse(response);
    console.log(`[ZephyrUtil] Created test case: ${json.key}`);
    return json.key;
  }

  // ---------- Create Test Cycle ----------

  static async createTestCycle(opts: {
    name: string;
    description?: string;
    jiraProjectVersion?: string;
  }): Promise<string> {
    const body = JSON.stringify({
      projectKey: ZephyrUtil.projectKey,
      name: opts.name,
      description: opts.description ?? `Automated run: ${new Date().toISOString()}`,
      statusName: 'In Progress',
    });

    const response = await ZephyrUtil._post('/testcycles', body);
    const json = JSON.parse(response);
    console.log(`[ZephyrUtil] Created test cycle: ${json.key}`);
    return json.key;
  }

  // ---------- Post Test Execution ----------

  static async postExecution(opts: {
    testCycleKey: string;
    result: ZephyrTestResult;
  }): Promise<void> {
    const body = JSON.stringify({
      projectKey: ZephyrUtil.projectKey,
      testCycleKey: opts.testCycleKey,
      testCaseKey: opts.result.testCaseKey,
      statusName: opts.result.statusName,
      comment: opts.result.comment ?? '',
      executionTime: opts.result.executionTime ?? 0,
    });

    await ZephyrUtil._post('/testexecutions', body);
    console.log(`[ZephyrUtil] Posted execution for ${opts.result.testCaseKey}: ${opts.result.statusName}`);
  }

  // ---------- Post Bulk Executions ----------

  static async postBulkExecutions(opts: {
    testCycleKey: string;
    results: ZephyrTestResult[];
  }): Promise<void> {
    for (const result of opts.results) {
      await ZephyrUtil.postExecution({
        testCycleKey: opts.testCycleKey,
        result,
      });
    }
  }

  // ---------- Get Test Cases by Jira Issue ----------

  static async getTestCasesByIssue(issueKey: string): Promise<any[]> {
    const response = await ZephyrUtil._get(
      `/testcases?projectKey=${ZephyrUtil.projectKey}&jiraIssueKey=${issueKey}`
    );
    const json = JSON.parse(response);
    return json.values ?? [];
  }

  // ---------- Private HTTP helpers ----------

  private static _post(path: string, body: string): Promise<string> {
    return ZephyrUtil._request('POST', path, body);
  }

  private static _get(path: string): Promise<string> {
    return ZephyrUtil._request('GET', path);
  }

  private static _request(method: string, path: string, body?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${ZephyrUtil.baseUrl}${path}`);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Bearer ${ZephyrUtil.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`[ZephyrUtil] HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}