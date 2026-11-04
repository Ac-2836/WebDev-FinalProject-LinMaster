import {existsSync} from 'node:fs';

import {defineConfig} from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  // One .prisma file per module in this folder (PLAN B3), e.g. auth.prisma, vocab.prisma.
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // `prisma generate` does not need a database, so an unset URL only fails commands that connect.
  datasource: {url: process.env.DATABASE_URL ?? ''},
});
