import { test, expect } from '@playwright/test';
// Prefer project API client if available; otherwise use lightweight fallback.
let apiClient: (baseUrl?: string) => {
  get(path: string): Promise<{ status: number; json: () => Promise<any>; text: () => Promise<string> }>;
};

try {
  // Load optionally present client at runtime (avoid static import so missing file doesn't break loading)
  // Use eval to hide the static require from Playwright's transformer/static analyzers so a missing file won't cause a transform-time error.
  let maybe: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-var-requires
    maybe = eval("typeof require !== 'undefined' ? require('../src/api/client') : undefined");
  } catch {
    maybe = undefined;
  }
  if (typeof maybe === 'function') {
    apiClient = maybe;
  } else if (maybe && typeof maybe.default === 'function') {
    apiClient = maybe.default;
  }
} catch {
  apiClient = function apiClient(baseUrl: string = process.env.API_BASE_URL ?? 'http://localhost:3000') {
    return {
      async get(path: string) {
        const url = new URL(path, baseUrl).toString();
        const res = await fetch(url);
        return { status: res.status, json: async () => res.json(), text: async () => res.text() };
      }
    };
  };
}

test.describe('Auth API', () => {
  test('should return 200 on health or login endpoint (example)', async () => {
    const client = apiClient();
    // Example: check base responds (adjust endpoint to real API)
    const resp = await client.get('/');
    expect(resp.status).toBeGreaterThanOrEqual(200);
    expect(resp.status).toBeLessThan(400);
  });
});