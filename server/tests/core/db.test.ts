import {afterAll, describe, expect, it} from 'vitest';

import {getDb} from '../../src/core/db';

// Needs DATABASE_URL pointing at a running Postgres (docker compose locally, the service container in CI).
describe('getDb', () => {
  afterAll(() => getDb().$disconnect());

  it('connects to the database', async () => {
    const rows = await getDb().$queryRaw<{ok: number}[]>`select 1 as ok`;
    expect(rows).toEqual([{ok: 1}]);
  });

  it('returns the same client every time', () => {
    expect(getDb()).toBe(getDb());
  });
});
