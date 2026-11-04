import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {getDb} from '../../src/core/db';

// Schema check against the test database: unique keys and cascade from User.
const email = `core-schema-${Date.now()}@linmaster.test`;
const task = `schema-test.v1-${Date.now()}`;

describe('core tables', () => {
  const db = getDb();
  let userId: string;

  beforeAll(async () => {
    userId = (await db.user.create({data: {email, passwordHash: 'x', displayName: 'Core Schema'}})).id;
  });
  afterAll(async () => {
    await db.aiCache.deleteMany({where: {task}});
    await db.user.deleteMany({where: {email}});
    await db.$disconnect();
  });

  it('allows one AiCache row per (task, inputHash)', async () => {
    const row = {task, inputHash: 'a'.repeat(64), output: {ok: true}, model: 'test-model'};
    await db.aiCache.create({data: row});
    await expect(db.aiCache.create({data: row})).rejects.toMatchObject({code: 'P2002'});
  });

  it('rejects a duplicate StoredFile storageKey', async () => {
    const file = {ownerId: userId, storageKey: `tests/${task}.pdf`, mimeType: 'application/pdf', sizeBytes: 1};
    await db.storedFile.create({data: {...file, originalName: 'a.pdf'}});
    await expect(db.storedFile.create({data: {...file, originalName: 'b.pdf'}})).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('deletes AiUsage and StoredFile rows with their user', async () => {
    await db.aiUsage.create({data: {userId, task, cached: false}});
    await db.user.delete({where: {id: userId}});
    expect(await db.aiUsage.count({where: {userId}})).toBe(0);
    expect(await db.storedFile.count({where: {ownerId: userId}})).toBe(0);
  });
});
