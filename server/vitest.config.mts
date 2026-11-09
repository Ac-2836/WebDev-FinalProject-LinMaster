import {existsSync} from 'node:fs';
import path from 'node:path';

import {defineConfig} from 'vitest/config';

if (existsSync('.env')) process.loadEnvFile('.env');
// Tests use the separate test database (docker/postgres/init), never dev data. CI sets DATABASE_URL directly.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
// A deterministic throwaway key keeps env validation working in tests; it is never used by the app runtime.
process.env.JWT_SECRET ??= 'linmaster-vitest-only-secret-32chars';

export default defineConfig({
  resolve: {alias: {'@linmaster/shared': path.resolve(process.cwd(), '../shared/src/index.ts')}},
  test: {include: ['tests/**/*.test.ts']},
});
