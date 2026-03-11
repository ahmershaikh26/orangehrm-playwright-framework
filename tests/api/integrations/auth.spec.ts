import { test, expect } from '@playwright/test';
import { apiClient } from '../../../src/api/client';
import { users } from '../../../src/fixtures/users';

const client = apiClient();

// endpoints can be configured via env; fall back to common paths
const LOGIN_ENDPOINT = process.env.API_LOGIN_ENDPOINT || '/auth/login';
const REGISTER_ENDPOINT = process.env.API_REGISTER_ENDPOINT || '/auth/register';

test.describe('Authentication API Tests', () => {
  test('API base responds (health)', async () => {
    const resp = await client.get('/');
    expect(resp.status).toBeGreaterThanOrEqual(200);
    expect(resp.status).toBeLessThan(400);
  });

  test('User can log in with valid credentials', async () => {
    const username = process.env.UI_USERNAME || users?.admin?.username;
    const password = process.env.UI_PASSWORD || users?.admin?.password;
    const resp = await client.post(LOGIN_ENDPOINT, { username, password });
    expect([200, 201]).toContain(resp.status);
    expect(resp.data).toBeDefined();
  });

  test('User cannot log in with invalid credentials', async () => {
    const resp = await client.post(LOGIN_ENDPOINT, { username: 'invalid_user', password: 'invalid_pass' });
    // many APIs return 4xx for invalid login; accept any non-success code
    if (resp.status >= 200 && resp.status < 400) {
      // if API returns 200 with error payload, assert presence of error token/message
      expect(resp.data).toBeDefined();
      expect(
        resp.data.error || resp.data.message || resp.data.detail || resp.data.status
      ).toBeDefined();
    } else {
      expect(resp.status).toBeGreaterThanOrEqual(400);
    }
  });

  test.describe('Registration (optional)', () => {
    const canRegister = !!process.env.API_REGISTER_ENDPOINT || REGISTER_ENDPOINT !== '/auth/register';
    test.skip(!canRegister, 'Registration endpoint not configured; skipping tests for register.');

    test('User can register with valid data', async () => {
      const newUser = {
        username: `user_${Date.now()}`,
        password: 'Password123!',
        email: `user_${Date.now()}@example.com`,
      };
      const resp = await client.post(REGISTER_ENDPOINT, newUser);
      expect([200, 201]).toContain(resp.status);
      expect(resp.data).toBeDefined();
    });

    test('User cannot register with existing username', async () => {
      const resp = await client.post(REGISTER_ENDPOINT, {
        username: process.env.UI_USERNAME || users?.admin?.username,
        password: 'Password123!',
        email: `dup_${Date.now()}@example.com`,
      });
      // Accept either conflict code or error payload
      if (resp.status >= 400) {
        expect(resp.status).toBeGreaterThanOrEqual(400);
      } else {
        expect(resp.data).toBeDefined();
        expect(resp.data.error || resp.data.message).toBeDefined();
      }
    });
  });
});