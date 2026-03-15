import https from 'https';

interface TestRailResult {
  case_id: number;
  status_id: 1 | 2 | 3 | 4 | 5; // 1=Pass 2=Blocked 3=Untested 4=Retest 5=Fail
  comment?: string;
  elapsed?: string;
}

export class TestRailUtil {

  private static get baseUrl(): string {
    return process.env.TESTRAIL_BASE_URL ?? '';
  }

  private static get auth(): string {
    const email = process.env.TESTRAIL_EMAIL ?? '';
    const key = process.env.TESTRAIL_API_KEY ?? '';
    return Buffer.from(`${email}:${key}`).toString('base64');
  }

  private static get projectId(): number {
    return Number(process.env.TESTRAIL_PROJECT_ID ?? 1);
  }

  // ---------- Create Test Run ----------

  static async createTestRun(name: string, caseIds: number[]): Promise<number> {
    const body = JSON.stringify({
      name,
      case_ids: caseIds,
      include_all: caseIds.length === 0,
    });

    const response = await TestRailUtil._post(
      `/index.php?/api/v2/add_run/${TestRailUtil.projectId}`,
      body
    );
    const json = JSON.parse(response);
    console.log(`[TestRail] Created run: ${json.id} - ${json.name}`);
    return json.id;
  }

  // ---------- Add Results ----------

  static async addResults(runId: number, results: TestRailResult[]): Promise<void> {
    const body = JSON.stringify({ results });
    await TestRailUtil._post(
      `/index.php?/api/v2/add_results_for_cases/${runId}`,
      body
    );
    console.log(`[TestRail] ✅ Posted ${results.length} results to run ${runId}`);
  }

  // ---------- Create Test Case ----------

  static async createTestCase(opts: {
    suiteId?: number;
    sectionId?: number;
    title: string;
    stepsFormatted?: string;
    expectedResult?: string;
  }): Promise<number> {
    const sectionId = opts.sectionId ?? 1;
    const body = JSON.stringify({
      title: opts.title,
      custom_steps: opts.stepsFormatted ?? '',
      custom_expected: opts.expectedResult ?? '',
    });

    const response = await TestRailUtil._post(
      `/index.php?/api/v2/add_case/${sectionId}`,
      body
    );
    const json = JSON.parse(response);
    console.log(`[TestRail] Created case: C${json.id} - ${json.title}`);
    return json.id;
  }

  // ---------- Get Test Cases ----------

  static async getTestCases(suiteId?: number): Promise<any[]> {
    const url = suiteId
      ? `/index.php?/api/v2/get_cases/${TestRailUtil.projectId}&suite_id=${suiteId}`
      : `/index.php?/api/v2/get_cases/${TestRailUtil.projectId}`;

    const response = await TestRailUtil._get(url);
    const json = JSON.parse(response);
    return json.cases ?? json ?? [];
  }

  // ---------- Private HTTP helpers ----------

  private static _post(path: string, body: string): Promise<string> {
    return TestRailUtil._request('POST', path, body);
  }

  private static _get(path: string): Promise<string> {
    return TestRailUtil._request('GET', path);
  }

  private static _request(method: string, path: string, body?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${TestRailUtil.baseUrl}${path}`);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Basic ${TestRailUtil.auth}`,
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
            reject(new Error(`[TestRail] HTTP ${res.statusCode}: ${data}`));
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