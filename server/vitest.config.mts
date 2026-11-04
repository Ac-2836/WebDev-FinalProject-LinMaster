import {existsSync} from 'node:fs';

import {defineConfig} from 'vitest/config';

if (existsSync('.env')) process.loadEnvFile('.env');
// Tests use the separate test database (docker/postgres/init), never dev data. CI sets DATABASE_URL directly.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export default defineConfig({test: {include: ['tests/**/*.test.ts']}});
