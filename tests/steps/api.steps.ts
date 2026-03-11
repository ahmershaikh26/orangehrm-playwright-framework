import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { apiClient } from '../../src/api/client';

declare module '@cucumber/cucumber' {
  interface World {
    apiResponse?: any;
  }
}

Given('the API base is reachable', async function () {
  const client = apiClient();
  const resp = await client.get('/');
  expect(resp.status).toBeGreaterThanOrEqual(200);
  expect(resp.status).toBeLessThan(400);
});

When('I call the health endpoint', async function () {
  const client = apiClient();
  const path = process.env.API_HEALTH_ENDPOINT || '/';
  this.apiResponse = await client.get(path);
});

Then('the response status should be 2xx', async function () {
  expect(this.apiResponse).toBeDefined();
  const status = this.apiResponse.status;
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(400);
});

Then('if a JSON body contains {string} it should be {string}', async function (field: string, expected: string) {
  const data = this.apiResponse?.data;
  if (!data || typeof data !== 'object') return;
  if (field in data) {
    expect(String((data as any)[field]).toLowerCase()).toBe(expected.toLowerCase());
  }
});

When('I POST to the login endpoint with {string} and {string}', async function (username: string, password: string) {
  const client = apiClient();
  const user = username === '<env>' ? (process.env.API_USERNAME || process.env.UI_USERNAME || username) : username;
  const pass = password === '<env>' ? (process.env.API_PASSWORD || process.env.UI_PASSWORD || password) : password;
  const path = process.env.API_LOGIN_ENDPOINT || '/auth/login';
  this.apiResponse = await client.post(path, { username: user, password: pass }).catch(e => e.response || e);
});