import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {getDb} from '../../src/core/db';

// Schema check against the test database: public columns, copies and one report per person per content.
const email = `library-schema-${Date.now()}@linmaster.test`;

describe('library tables and columns', () => {
  const db = getDb();
  let userId: string;

  beforeAll(async () => {
    userId = (await db.user.create({data: {email, passwordHash: 'x', displayName: 'Library Schema'}})).id;
  });
  afterAll(async () => {
    await db.user.deleteMany({where: {email}});
    await db.$disconnect();
  });

  it('creates private content with zero counters by default', async () => {
    const set = await db.flashcardSet.create({data: {ownerId: userId, title: 'Set'}});
    const test = await db.test.create({
      data: {ownerId: userId, certification: 'IELTS_ACADEMIC', kind: 'reading', title: 'Sample'},
    });
    expect(set).toMatchObject({visibility: 'private', publishedAt: null, copyCount: 0, copiedFromId: null});
    expect(test).toMatchObject({visibility: 'private', publishedAt: null, attemptCount: 0});
  });

  it('keeps a copy when the original set is deleted', async () => {
    const original = await db.flashcardSet.create({data: {ownerId: userId, title: 'Original', visibility: 'public'}});
    const copy = await db.flashcardSet.create({data: {ownerId: userId, title: 'Copy', copiedFromId: original.id}});
    await db.flashcardSet.delete({where: {id: original.id}});
    expect((await db.flashcardSet.findUniqueOrThrow({where: {id: copy.id}})).copiedFromId).toBeNull();
  });

  it('allows one report per person per content, open by default', async () => {
    const set = await db.flashcardSet.create({data: {ownerId: userId, title: 'Reported', visibility: 'public'}});
    const report = {
      reporterId: userId,
      targetType: 'flashcard_set' as const,
      targetId: set.id,
      reason: 'other' as const,
    };
    expect(await db.report.create({data: report})).toMatchObject({status: 'open'});
    await expect(db.report.create({data: report})).rejects.toMatchObject({code: 'P2002'});
  });
});
