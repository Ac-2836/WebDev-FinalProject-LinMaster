import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {getDb} from '../../src/core/db';

// Schema check against the test database: defaults, uuid ids and the unique email constraint.
const email = `schema-test-${Date.now()}@linmaster.test`;

describe('User table', () => {
  const db = getDb();

  beforeAll(() => db.user.deleteMany({where: {email}}));
  afterAll(async () => {
    await db.user.deleteMany({where: {email}});
    await db.$disconnect();
  });

  it('creates a user with a v7 uuid and default locale', async () => {
    const user = await db.user.create({data: {email, passwordHash: 'x', displayName: 'Schema Test'}});
    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(user.locale).toBe('vi');
    expect(user.targetBand).toBeNull();
  });

  it('rejects a duplicate email', async () => {
    await expect(db.user.create({data: {email, passwordHash: 'x', displayName: 'Dup'}})).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});
