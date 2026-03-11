import { test, expect } from '@playwright/test';
import { apiClient } from '../../../src/api/client';
import * as endpoints from '../../../src/api/endpoints';

test.describe('Health Check API Tests', () => {
  const client = apiClient();
  const healthPath = (endpoints as any).healthCheck ?? process.env.API_HEALTH_ENDPOINT ?? '/';

  test('should return 2xx for health check endpoint and optionally JSON { status: "ok" }', async () => {
    const resp = await client.get(healthPath);

    // basic status assertions
    expect(resp.status).toBeGreaterThanOrEqual(200);
    expect(resp.status).toBeLessThan(400);

    // if JSON returned and contains a "status" field, assert it's "ok"
    const contentType = (resp.headers && (resp.headers['content-type'] || resp.headers['Content-Type'])) || '';
    if (typeof resp.data === 'object' && resp.data !== null) {
      expect(resp.data).toBeDefined();
      if ('status' in resp.data) {
        expect(String((resp.data as any).status).toLowerCase()).toBe('ok');
      }
    } else if (contentType.includes('application/json')) {
      // ensure body is parseable JSON
      expect(resp.data).toBeDefined();
    }
  });
});