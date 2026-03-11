import fs from 'fs';
import path from 'path';

type CucumberEnvelope = {
  gherkinDocument?: {
    uri?: string;
    feature?: {
      name?: string;
      keyword?: string;
      location?: { line?: number };
      tags?: Array<{ name?: string; location?: { line?: number } }>;
      children?: Array<{
        scenario?: {
          name?: string;
          keyword?: string;
          location?: { line?: number };
          steps?: Array<{ text?: string; keyword?: string; location?: { line?: number } }>;
          tags?: Array<{ name?: string; location?: { line?: number } }>;
        };
      }>;
    };
  };
  testCase?:
    | {
        id?: string;
        pickleId?: string;
        testSteps?: Array<{
          id?: string;
          pickleStepId?: string; // present for real steps; missing for hooks
        }>;
      }
    | undefined;
  pickle?:
    | {
        id?: string;
        uri?: string;
        name?: string;
        tags?: Array<{ name?: string }>;
        steps?: Array<{ id?: string; text?: string }>; // <-- include id
      }
    | undefined;
  testCaseStarted?:
    | {
        id?: string;
        testCaseId?: string;
      }
    | undefined;
  attachment?:
    | {
        testCaseStartedId?: string;
        testStepId?: string; // may be undefined depending on where you attach
        mediaType?: string;
        body?: string; // base64 string from cucumber message protocol
        fileName?: string;
      }
    | undefined;
  testStepFinished?:
    | {
        testCaseStartedId?: string;
        testStepId?: string; // <-- add this (needed to associate step results/attachments)
        testStepResult?: {
          status?: string;
          duration?: { seconds?: number; nanos?: number };
          message?: string;
        };
      }
    | undefined;
};

function durationToSeconds(d?: { seconds?: number; nanos?: number }): number {
  const seconds = d?.seconds ?? 0;
  const nanos = d?.nanos ?? 0;
  return seconds + nanos / 1e9;
}

function normalizeStatus(status?: string): 'passed' | 'failed' | 'skipped' | 'pending' | 'undefined' {
  switch ((status ?? '').toUpperCase()) {
    case 'PASSED':
      return 'passed';
    case 'FAILED':
      return 'failed';
    case 'SKIPPED':
      return 'skipped';
    case 'PENDING':
      return 'pending';
    default:
      return 'undefined';
  }
}

function slug(s: string): string {
  return (s || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  const ndjson = process.argv[2];
  const out = process.argv[3];

  if (!ndjson || !out) {
    console.error('Usage: ts-node scripts/converter-cucumber.ts <messages.ndjson> <out.json>');
    process.exit(2);
  }

  const envelopes: CucumberEnvelope[] = fs
    .readFileSync(ndjson, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as CucumberEnvelope);

  // Collect attachments by testCaseStartedId (screenshots, etc.)
  const attachmentsByStartedId = new Map<
    string,
    Array<{
      mediaType: string;
      body: string; // base64
      testStepId?: string;
    }>
  >();

  for (const e of envelopes) {
    const a = e.attachment;
    if (!a?.testCaseStartedId) continue;
    if (!a.body) continue;

    const arr = attachmentsByStartedId.get(a.testCaseStartedId) ?? [];
    arr.push({
      mediaType: a.mediaType ?? 'application/octet-stream',
      body: a.body,
      testStepId: a.testStepId,
    });
    attachmentsByStartedId.set(a.testCaseStartedId, arr);
  }

  // --- Collect Feature info (name/tags) by uri from gherkinDocument ---
  const featuresByUri = new Map<
    string,
    {
      name: string;
      keyword: string;
      line: number;
      tags: Array<{ name: string; line: number }>;
    }
  >();

  // Scenario scaffolding (steps keywords/lines) by (uri + scenario name)
  const scenarioScaffoldByKey = new Map<
    string,
    {
      keyword: string;
      line: number;
      tags: Array<{ name: string; line: number }>;
      steps: Array<{ keyword: string; name: string; line: number }>;
    }
  >();

  for (const e of envelopes) {
    const doc = e.gherkinDocument;
    const uri = doc?.uri;
    const f = doc?.feature;
    if (!uri || !f) continue;

    featuresByUri.set(uri, {
      name: f.name ?? path.basename(uri),
      keyword: f.keyword ?? 'Feature',
      line: f.location?.line ?? 1,
      tags: (f.tags ?? [])
        .map((t) => ({ name: t.name ?? '', line: t.location?.line ?? 1 }))
        .filter((t) => t.name),
    });

    for (const child of f.children ?? []) {
      const s = child.scenario;
      if (!s?.name) continue;

      const key = `${uri}::${s.name}`;
      scenarioScaffoldByKey.set(key, {
        keyword: s.keyword ?? 'Scenario',
        line: s.location?.line ?? 1,
        tags: (s.tags ?? [])
          .map((t) => ({ name: t.name ?? '', line: t.location?.line ?? 1 }))
          .filter((t) => t.name),
        steps: (s.steps ?? [])
          .map((st) => ({
            keyword: st.keyword ?? '',
            name: st.text ?? '',
            line: st.location?.line ?? 1,
          }))
          .filter((st) => st.name),
      });
    }
  }

  // --- Collect pickle metadata (name/steps/tags/uri) ---
  const pickles = new Map<
    string,
    { uri?: string; name?: string; steps: Array<{ id: string; text: string }>; tags: string[] }
  >();

  for (const e of envelopes) {
    if (e.pickle?.id) {
      pickles.set(e.pickle.id, {
        uri: e.pickle.uri,
        name: e.pickle.name,
        steps: (e.pickle.steps ?? [])
          .map((s) => ({ id: s.id ?? '', text: s.text ?? '' }))
          .filter((s) => s.id && s.text),
        tags: (e.pickle.tags ?? []).map((t) => t.name ?? '').filter(Boolean),
      });
    }
  }

  // Map testCaseId -> pickleId + testStepId->pickleStepId map
  const testCases = new Map<
    string,
    { pickleId?: string; testStepIdToPickleStepId: Map<string, string> }
  >();

  for (const e of envelopes) {
    const tc = e.testCase;
    if (!tc?.id) continue;

    const map = new Map<string, string>();
    for (const ts of tc.testSteps ?? []) {
      if (ts.id && ts.pickleStepId) {
        map.set(ts.id, ts.pickleStepId);
      }
    }

    testCases.set(tc.id, { pickleId: tc.pickleId, testStepIdToPickleStepId: map });
  }

  // Map testCaseStartedId -> testCaseId
  const started = new Map<string, { testCaseId?: string }>();
  for (const e of envelopes) {
    if (e.testCaseStarted?.id) started.set(e.testCaseStarted.id, { testCaseId: e.testCaseStarted.testCaseId });
  }

  // Aggregate worst result per testCaseStartedId
  const resultsByStartedId = new Map<
    string,
    {
      totalDuration: number;
      worstStatus: 'passed' | 'failed' | 'skipped' | 'pending' | 'undefined';
      error?: string;
    }
  >();

  const statusRank: Record<string, number> = { failed: 5, undefined: 4, pending: 3, skipped: 2, passed: 1 };

  for (const e of envelopes) {
    const startedId = e.testStepFinished?.testCaseStartedId;
    if (!startedId) continue;

    const status = normalizeStatus(e.testStepFinished?.testStepResult?.status);
    const duration = durationToSeconds(e.testStepFinished?.testStepResult?.duration);
    const message = e.testStepFinished?.testStepResult?.message;

    const current =
      resultsByStartedId.get(startedId) ?? ({ totalDuration: 0, worstStatus: 'passed', error: undefined } as const);

    const next = { ...current, totalDuration: current.totalDuration + duration };

    if (statusRank[status] > statusRank[next.worstStatus]) {
      next.worstStatus = status;
      if (status === 'failed' && message) next.error = message;
    }

    resultsByStartedId.set(startedId, next);
  }

  // --- Build classic cucumber JSON: [{ uri, keyword, name, elements:[...] }] ---
  const featuresOutByUri = new Map<
    string,
    {
      uri: string;
      id: string;
      keyword: string;
      name: string;
      line: number;
      tags: Array<{ name: string; line: number }>;
      elements: any[];
    }
  >();

  for (const [startedId, res] of resultsByStartedId.entries()) {
    const testCaseId = started.get(startedId)?.testCaseId;
    const pickleId = testCaseId ? testCases.get(testCaseId)?.pickleId : undefined;
    const pickle = pickleId ? pickles.get(pickleId) : undefined;

    const uri = pickle?.uri ?? 'unknown.feature';
    const featureMeta = featuresByUri.get(uri);

    const featureName = featureMeta?.name ?? path.basename(uri);
    const featureKeyword = featureMeta?.keyword ?? 'Feature';
    const featureLine = featureMeta?.line ?? 1;
    const featureTags = featureMeta?.tags ?? [];

    const scenarioName = pickle?.name ?? `Scenario ${startedId}`;

    // Use scaffolded steps (keyword/line) if available; else fallback to pickle step names.
    const scaffoldKey = `${uri}::${scenarioName}`;
    const scaffold = scenarioScaffoldByKey.get(scaffoldKey);

    const scenarioTags = [
      ...(scaffold?.tags ?? []),
      ...(pickle?.tags ?? []).map((t) => ({ name: t, line: scaffold?.line ?? 1 })),
    ]
      // de-dupe
      .filter((t) => t.name)
      .filter((t, idx, arr) => arr.findIndex((x) => x.name === t.name) === idx);

    const stepsFromScaffold =
      scaffold?.steps ??
      (pickle?.steps ?? []).map((name, i) => ({
        keyword: '',
        name,
        line: (scaffold?.line ?? 1) + i,
      }));

    // Apply result to last step (helps reporters show scenario status), keep others passed/skipped as appropriate
    const totalNanos = Math.round(res.totalDuration * 1e9);
    const lastIdx = Math.max(0, stepsFromScaffold.length - 1);

    // Attachments by testCaseStartedId grouped by step index
    const attachmentsByStartedIdByStepIndex = new Map<
      string,
      Map<number, Array<{ mediaType: string; body: string }>>
    >();

    for (const e of envelopes) {
      const a = e.attachment;
      if (!a?.testCaseStartedId || !a.body) continue;

      const testCaseId = started.get(a.testCaseStartedId)?.testCaseId;
      if (!testCaseId) continue;

      const tc = testCases.get(testCaseId);
      const pickleId = tc?.pickleId;
      if (!tc || !pickleId) continue;

      const pickle = pickles.get(pickleId);
      if (!pickle) continue;

      // Map testStepId -> pickleStepId -> step index in pickle
      const pickleStepId = a.testStepId ? tc.testStepIdToPickleStepId.get(a.testStepId) : undefined;
      if (!pickleStepId) continue; // ignore hook-level attachments here

      const stepIndex = pickle.steps.findIndex((s) => s.id === pickleStepId);
      if (stepIndex < 0) continue;

      const byIndex = attachmentsByStartedIdByStepIndex.get(a.testCaseStartedId) ?? new Map();
      const arr = byIndex.get(stepIndex) ?? [];
      arr.push({ mediaType: a.mediaType ?? 'application/octet-stream', body: a.body });
      byIndex.set(stepIndex, arr);
      attachmentsByStartedIdByStepIndex.set(a.testCaseStartedId, byIndex);
    }

    const stepAttachments = attachmentsByStartedIdByStepIndex.get(startedId) ?? new Map<number, Array<{ mediaType: string; body: string }>>();

    const steps = stepsFromScaffold.map((st, idx) => {
      const imgs = (stepAttachments.get(idx) ?? [])
        .filter((a) => a.mediaType.startsWith('image/'))
        .map((a) => ({ mime_type: a.mediaType, data: a.body }));

      return {
        keyword: st.keyword ?? '',
        name: st.name ?? '',
        line: st.line ?? 1,
        result: {
          status: idx === lastIdx ? res.worstStatus : 'passed',
          duration: idx === lastIdx ? totalNanos : 0,
          ...(idx === lastIdx && res.error ? { error_message: res.error } : {}),
        },
        ...(imgs.length ? { embeddings: imgs } : {}),
      };
    });

    const scenarioEl = {
      id: `${slug(featureName)};${slug(scenarioName)}`,
      keyword: scaffold?.keyword ?? 'Scenario',
      name: scenarioName,
      description: '',
      line: scaffold?.line ?? 1,
      type: 'scenario',
      tags: scenarioTags,
      steps,
    };

    const existing =
      featuresOutByUri.get(uri) ??
      ({
        uri,
        id: slug(featureName),
        keyword: featureKeyword,
        name: featureName,
        line: featureLine,
        description: '',
        tags: featureTags,
        elements: [],
      } as any);

    existing.elements.push(scenarioEl);
    featuresOutByUri.set(uri, existing);
  }

  const json = Array.from(featuresOutByUri.values());

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(json, null, 2), 'utf8');
  console.log(`[convert] wrote ${out}`);
}

main().catch((e) => {
  console.error('[convert] failed:', e);
  process.exit(1);
});