import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';

import {defineConfig, devices} from '@playwright/test';

// E2E (P4-08): the real API with a fake AI model and the built client, both on local ports, on the test database.
// Run from client/: `npm run e2e`. Needs Postgres with migrations applied and `npm run build -w server`.

const serverDir = path.resolve(__dirname, '../../../server');
const serverEnv = path.join(serverDir, '.env');
// Locally the test database comes from server/.env (TEST_DATABASE_URL); CI sets DATABASE_URL to its own one.
// Only that value is read: loading the whole file would pass NODE_ENV=development to `next build`.
const localTestDb = existsSync(serverEnv) ? parseEnv(readFileSync(serverEnv, 'utf8')).TEST_DATABASE_URL : undefined;
const databaseUrl = process.env.E2E_DATABASE_URL ?? localTestDb ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set E2E_DATABASE_URL, TEST_DATABASE_URL or DATABASE_URL for the e2e API.');
// Tests that move an attempt's clock (tests/e2e/helpers.ts `endAttemptIn`) read it in the workers.
process.env.E2E_DATABASE_URL = databaseUrl;

const API_PORT = 4100;
const WEB_PORT = 3100;
const webUrl = `http://localhost:${WEB_PORT}`;
const apiUrl = `http://localhost:${API_PORT}/api/v1`;
const reuse = !process.env.CI;

export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.ts',
  outputDir: '../../test-results',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: {timeout: 15_000},
  reporter: process.env.CI ? [['github'], ['html', {outputFolder: '../../playwright-report', open: 'never'}]] : 'list',
  use: {
    baseURL: webUrl,
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'node ../client/tests/e2e/api-server.mjs',
      cwd: serverDir,
      url: `${apiUrl}/health`,
      reuseExistingServer: reuse,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL: databaseUrl,
        JWT_SECRET: 'e2e-only-secret-that-is-at-least-32-characters-long',
        CORS_ORIGINS: webUrl,
        STORAGE_DRIVER: 'local',
        GEMINI_API_KEY: '',
      },
    },
    {
      // `npm run build` (not `next build`) so prebuild copies the in-browser OCR assets the upload page needs.
      command: `npm run build && npx next start --port ${WEB_PORT}`,
      cwd: path.resolve(__dirname, '../..'),
      url: webUrl,
      reuseExistingServer: reuse,
      timeout: 300_000,
      env: {NEXT_PUBLIC_API_URL: apiUrl, NEXT_TELEMETRY_DISABLED: '1'},
    },
  ],
});
