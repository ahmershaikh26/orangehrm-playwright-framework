import https from 'https';
import http from 'http';

export interface AICompletionOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface AITriageResult {
  conclusions: string[];
  actions: string[];
  snippets: string[];
}

export class AIUtil {
  // ---------- Core completion ----------

  static async completion(prompt: string, maxTokens = 800, opts: AICompletionOptions = {}): Promise<string> {
    const provider = String(process.env.AI_PROVIDER ?? 'openai').toLowerCase();

    if (provider === 'openai') return AIUtil._openai(prompt, maxTokens, opts);
    if (provider === 'anthropic') return AIUtil._anthropic(prompt, maxTokens, opts);

    // Fallback stub (no key configured)
    console.warn('[AIUtil] No AI_PROVIDER configured — returning stub response.');
    return JSON.stringify({
      conclusions: ['AI service not configured — this is a local stub.'],
      actions: [],
      snippets: [],
    } satisfies AITriageResult);
  }

  // ---------- Generate Gherkin feature from Jira story ----------

  static async generateFeatureFile(opts: {
    storyKey: string;
    title: string;
    description: string;
    acceptanceCriteria: string;
  }): Promise<string> {
    const prompt = `You are a senior QA engineer who writes Cucumber BDD tests.

Given the following Jira User Story, generate a complete Gherkin .feature file.

Rules:
- Use Feature / Background (if needed) / Scenario Outline (for data-driven) / Scenario
- Add relevant tags: @smoke @regression @desktop @mobile and a unique @TC_X tag
- Steps should be reusable and match common Given/When/Then patterns
- Include Examples table for Scenario Outlines
- Do NOT include markdown code fences, output raw Gherkin only

Story Key: ${opts.storyKey}
Title: ${opts.title}
Description: ${opts.description}
Acceptance Criteria:
${opts.acceptanceCriteria}`;

    return AIUtil.completion(prompt, 1200);
  }

  // ---------- Generate step definitions from feature file ----------

  static async generateStepDefinitions(featureContent: string): Promise<string> {
    const prompt = `You are a senior TypeScript automation engineer.

Given the following Cucumber feature file, generate TypeScript step definitions using:
- @cucumber/cucumber (Given/When/Then)
- Playwright for browser interactions
- this.pages!.<pageName>.<method>() pattern for page object access
- async/await throughout
- No markdown, output raw TypeScript only

Feature file:
${featureContent}`;

    return AIUtil.completion(prompt, 1500);
  }

  // ---------- Triage failures ----------

  static async triageFailures(failures: Array<{ title: string; test: string; error: string }>): Promise<AITriageResult> {
    if (failures.length === 0) return { conclusions: [], actions: [], snippets: [] };

    const sample = failures
      .slice(0, 6)
      .map(
        (f, i) => `Failure #${i + 1}
Title: ${f.title}
Test: ${f.test}
Error: ${f.error}`
      )
      .join('\n---\n');

    const prompt = `You are a senior QA engineer. Analyze the following test failures and provide:
1) Short root-cause hypotheses (ranked)
2) Immediate actionable fixes (selectors, waits, retries, test-data)
3) Suggested quarantine or retry policy per failure
4) A one-line fix snippet or xpath suggestion if applicable
Respond ONLY in JSON with keys: conclusions (string[]), actions (string[]), snippets (string[]).

Failures:
${sample}

Keep answers concise and actionable.`;

    const raw = await AIUtil.completion(prompt, 800);
    try {
      return JSON.parse(raw) as AITriageResult;
    } catch {
      return { conclusions: [raw], actions: [], snippets: [] };
    }
  }

  // ---------- Private: OpenAI ----------

  private static async _openai(prompt: string, maxTokens: number, opts: AICompletionOptions): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('[AIUtil] OPENAI_API_KEY is not set.');

    const body = JSON.stringify({
      model: opts.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: opts.temperature ?? 0.3,
    });

    const raw = await AIUtil._post('https://api.openai.com/v1/chat/completions', body, {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    });

    const json = JSON.parse(raw);
    return json.choices?.[0]?.message?.content ?? '';
  }

  // ---------- Private: Anthropic (Claude) ----------

  private static async _anthropic(prompt: string, maxTokens: number, opts: AICompletionOptions): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('[AIUtil] ANTHROPIC_API_KEY is not set.');

    const body = JSON.stringify({
      model: opts.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = await AIUtil._post('https://api.anthropic.com/v1/messages', body, {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    });

    const json = JSON.parse(raw);
    return json.content?.[0]?.text ?? '';
  }

  // ---------- Private: generic HTTP POST ----------

  private static _post(url: string, body: string, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;

      const req = lib.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: 'POST',
          headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`[AIUtil] HTTP ${res.statusCode}: ${data}`));
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