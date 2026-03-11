import https from 'https';
import http from 'http';
import fs from 'fs';

export interface JiraIssue {
  key: string;
  id: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  status: string;
  issueType: string;
  labels: string[];
  assignee?: string;
}

export interface JiraCreateBugOptions {
  projectKey: string;
  summary: string;
  description: string;
  storyKey?: string;       // linked story
  screenshotPath?: string; // attach screenshot
  priority?: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  labels?: string[];
}

export interface JiraTransitionOptions {
  issueKey: string;
  transitionName: string; // e.g. "Done", "In Progress", "In Testing"
}

export class JiraUtil {
  private static get baseUrl(): string {
    const url = process.env.JIRA_BASE_URL;
    if (!url) throw new Error('[JiraUtil] JIRA_BASE_URL is not set.');
    return url.replace(/\/$/, '');
  }

  private static get authHeader(): string {
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_API_TOKEN;
    if (!email || !token) throw new Error('[JiraUtil] JIRA_EMAIL or JIRA_API_TOKEN is not set.');
    return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
  }

  // ---------- Get issue ----------

  static async getIssue(issueKey: string): Promise<JiraIssue> {
    const raw = await JiraUtil._request('GET', `/rest/api/3/issue/${issueKey}`);
    const json = JSON.parse(raw);

    // Extract acceptance criteria from description (Jira stores it in ADF format)
    const description = JiraUtil._extractText(json.fields?.description);
    const ac = JiraUtil._extractText(json.fields?.customfield_10016) // common AC field
      || JiraUtil._extractAcceptanceCriteria(description);

    return {
      key: json.key,
      id: json.id,
      summary: json.fields?.summary ?? '',
      description,
      acceptanceCriteria: ac,
      status: json.fields?.status?.name ?? '',
      issueType: json.fields?.issuetype?.name ?? '',
      labels: json.fields?.labels ?? [],
      assignee: json.fields?.assignee?.displayName,
    };
  }

  // ---------- Add comment ----------

  static async addComment(issueKey: string, body: string): Promise<void> {
    const payload = JSON.stringify({
      body: {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: body }],
          },
        ],
      },
    });

    await JiraUtil._request('POST', `/rest/api/3/issue/${issueKey}/comment`, payload);
    console.log(`[JiraUtil] Comment added to ${issueKey}`);
  }

  // ---------- Create bug ----------

  static async createBug(opts: JiraCreateBugOptions): Promise<string> {
    const payload = JSON.stringify({
      fields: {
        project: { key: opts.projectKey },
        summary: opts.summary,
        description: {
          version: 1,
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: opts.description }],
            },
          ],
        },
        issuetype: { name: 'Bug' },
        priority: { name: opts.priority ?? 'High' },
        labels: opts.labels ?? ['automation', 'auto-created'],
      },
    });

    const raw = await JiraUtil._request('POST', '/rest/api/3/issue', payload);
    const json = JSON.parse(raw);
    const bugKey = json.key as string;

    console.log(`[JiraUtil] Bug created: ${bugKey}`);

    // Link to story if provided
    if (opts.storyKey) {
      await JiraUtil.linkIssues(bugKey, opts.storyKey, 'is caused by');
    }

    // Attach screenshot if provided
    if (opts.screenshotPath && fs.existsSync(opts.screenshotPath)) {
      await JiraUtil.attachFile(bugKey, opts.screenshotPath);
    }

    return bugKey;
  }

  // ---------- Transition issue ----------

  static async transition(opts: JiraTransitionOptions): Promise<void> {
    const raw = await JiraUtil._request('GET', `/rest/api/3/issue/${opts.issueKey}/transitions`);
    const json = JSON.parse(raw);

    const match = (json.transitions ?? []).find(
      (t: any) => t.name.toLowerCase() === opts.transitionName.toLowerCase()
    );

    if (!match) {
      const available = (json.transitions ?? []).map((t: any) => t.name).join(', ');
      throw new Error(`[JiraUtil] Transition "${opts.transitionName}" not found. Available: ${available}`);
    }

    await JiraUtil._request(
      'POST',
      `/rest/api/3/issue/${opts.issueKey}/transitions`,
      JSON.stringify({ transition: { id: match.id } })
    );

    console.log(`[JiraUtil] ${opts.issueKey} transitioned to "${opts.transitionName}"`);
  }

  // ---------- Link issues ----------

  static async linkIssues(inwardKey: string, outwardKey: string, linkType = 'relates to'): Promise<void> {
    const payload = JSON.stringify({
      type: { name: linkType },
      inwardIssue: { key: inwardKey },
      outwardIssue: { key: outwardKey },
    });

    await JiraUtil._request('POST', '/rest/api/3/issueLink', payload);
    console.log(`[JiraUtil] Linked ${inwardKey} → ${outwardKey} (${linkType})`);
  }

  // ---------- Attach file ----------

  static async attachFile(issueKey: string, filePath: string): Promise<void> {
    // Multipart form upload
    const boundary = `----FormBoundary${Date.now()}`;
    const filename = filePath.split('/').pop()!;
    const fileContent = fs.readFileSync(filePath);

    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileContent, footer]);

    await JiraUtil._request(
      'POST',
      `/rest/api/3/issue/${issueKey}/attachments`,
      body,
      {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'X-Atlassian-Token': 'no-check',
      }
    );

    console.log(`[JiraUtil] Attached ${filename} to ${issueKey}`);
  }

  // ---------- Post test results as comment ----------

  static async postTestResults(opts: {
    issueKey: string;
    passed: number;
    failed: number;
    total: number;
    reportUrl?: string;
    failedScenarios?: string[];
  }): Promise<void> {
    const status = opts.failed === 0 ? '✅ All tests passed' : `❌ ${opts.failed} test(s) failed`;
    const lines = [
      `*Automated Test Results* — ${new Date().toISOString()}`,
      `${status}`,
      `Passed: ${opts.passed} | Failed: ${opts.failed} | Total: ${opts.total}`,
      opts.reportUrl ? `Report: ${opts.reportUrl}` : '',
      opts.failedScenarios?.length
        ? `Failed Scenarios:\n${opts.failedScenarios.map((s) => `  - ${s}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    await JiraUtil.addComment(opts.issueKey, lines);
  }

  // ---------- Private helpers ----------

  private static _extractText(adf: any): string {
    if (!adf) return '';
    if (typeof adf === 'string') return adf;

    const lines: string[] = [];
    const walk = (node: any) => {
      if (node?.type === 'text') lines.push(node.text ?? '');
      for (const child of node?.content ?? []) walk(child);
    };
    walk(adf);
    return lines.join(' ').trim();
  }

  private static _extractAcceptanceCriteria(description: string): string {
    const match = description.match(/acceptance criteria[:\s]+([\s\S]+?)(\n\n|$)/i);
    return match ? match[1].trim() : description;
  }

  private static _request(
    method: string,
    path: string,
    body?: string | Buffer,
    extraHeaders: Record<string, string> = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const u = new URL(JiraUtil.baseUrl + path);
      const lib = u.protocol === 'https:' ? https : http;
      const isBuffer = Buffer.isBuffer(body);

      const headers: Record<string, string> = {
        Authorization: JiraUtil.authHeader,
        Accept: 'application/json',
        ...(!isBuffer ? { 'Content-Type': 'application/json' } : {}),
        ...(body ? { 'Content-Length': String(Buffer.byteLength(body)) } : {}),
        ...extraHeaders,
      };

      const req = lib.request(
        { hostname: u.hostname, path: u.pathname + u.search, method, headers },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const data = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`[JiraUtil] HTTP ${res.statusCode}: ${data}`));
            } else {
              resolve(data);
            }
          });
        }
      );

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}