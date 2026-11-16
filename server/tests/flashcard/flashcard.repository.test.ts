import express from 'express';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {getDb} from '../../src/core/db';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {createFlashcardModule} from '../../src/modules/flashcard';
import {prismaFlashcardRepository} from '../../src/modules/flashcard/flashcard.repository';

const JWT_SECRET = 'flashcard-repository-test-secret-that-is-long-enough';
const testRun = `${Date.now()}`;
const ownerEmail = `flashcard-owner-${testRun}@linmaster.test`;
const otherEmail = `flashcard-other-${testRun}@linmaster.test`;

describe('Prisma flashcard repository', () => {
  const db = getDb();
  let ownerId: string;
  let otherUserId: string;

  beforeAll(async () => {
    ownerId = (await db.user.create({data: {email: ownerEmail, passwordHash: 'x', displayName: 'Flashcard owner'}})).id;
    otherUserId = (await db.user.create({data: {email: otherEmail, passwordHash: 'x', displayName: 'Other owner'}})).id;
  });

  afterAll(async () => {
    const userIds = [ownerId, otherUserId].filter((id): id is string => id !== undefined);
    if (userIds.length > 0) await db.user.deleteMany({where: {id: {in: userIds}}});
    await db.$disconnect();
  });

  it('keeps progress and review history for cards retained during replacement', async () => {
    const set = await prismaFlashcardRepository.createSet(ownerId, {
      title: `Progress preservation ${testRun}`,
      termLang: 'en',
      definitionLang: 'vi',
    });
    const originalCards = await prismaFlashcardRepository.replaceCards(ownerId, set.id, [
      {term: 'mitigate', definition: 'giảm nhẹ'},
      {term: 'obsolete', definition: 'lỗi thời'},
    ]);
    expect(originalCards).not.toBeNull();
    const retainedCard = originalCards![0];
    const removedCard = originalCards![1];
    const dueAt = new Date('2026-12-01T00:00:00.000Z');

    await db.cardProgress.create({
      data: {
        userId: ownerId,
        cardId: retainedCard.id,
        easiness: 2.7,
        intervalDays: 6,
        repetitions: 3,
        lapses: 1,
        dueAt,
        lastReviewedAt: new Date('2026-11-01T00:00:00.000Z'),
      },
    });
    await db.reviewLog.create({
      data: {
        userId: ownerId,
        cardId: retainedCard.id,
        rating: 'good',
        intervalBefore: 3,
        intervalAfter: 6,
      },
    });

    const updatedCards = await prismaFlashcardRepository.replaceCards(ownerId, set.id, [
      {id: retainedCard.id, term: 'mitigated', definition: 'đã giảm nhẹ'},
      {term: 'resilient', definition: 'kiên cường'},
    ]);
    const progress = await db.cardProgress.findUniqueOrThrow({
      where: {userId_cardId: {userId: ownerId, cardId: retainedCard.id}},
    });
    const reviewCount = await db.reviewLog.count({where: {cardId: retainedCard.id, userId: ownerId}});

    expect(updatedCards).toHaveLength(2);
    expect(updatedCards![0]).toMatchObject({id: retainedCard.id, term: 'mitigated', position: 0});
    expect(progress).toMatchObject({easiness: 2.7, intervalDays: 6, repetitions: 3, lapses: 1, dueAt});
    expect(reviewCount).toBe(1);
    expect(await db.card.findUnique({where: {id: removedCard.id}})).toBeNull();
    const updatedSet = await db.flashcardSet.findUniqueOrThrow({where: {id: set.id}});
    expect(updatedSet.updatedAt.getTime()).toBeGreaterThan(new Date(set.updatedAt).getTime());
  });

  it('scopes set reads and edits to the owner', async () => {
    const set = await prismaFlashcardRepository.createSet(ownerId, {
      title: `Owner check ${testRun}`,
      termLang: 'en',
      definitionLang: 'vi',
    });

    expect(await prismaFlashcardRepository.findSet(otherUserId, set.id)).toBeNull();
    expect(await prismaFlashcardRepository.updateSet(otherUserId, set.id, {title: 'stolen'})).toBeNull();
    expect(await prismaFlashcardRepository.deleteSet(otherUserId, set.id)).toBe(false);
    expect(await prismaFlashcardRepository.replaceCards(otherUserId, set.id, [])).toBeNull();
    expect((await prismaFlashcardRepository.findSet(ownerId, set.id))?.title).toBe(`Owner check ${testRun}`);

    const foreignSet = await prismaFlashcardRepository.createSet(otherUserId, {
      title: `Other set ${testRun}`,
      termLang: 'en',
      definitionLang: 'vi',
    });
    const [foreignCard] = (await prismaFlashcardRepository.replaceCards(otherUserId, foreignSet.id, [
      {term: 'private', definition: 'riêng tư'},
    ]))!;
    await expect(
      prismaFlashcardRepository.replaceCards(ownerId, set.id, [
        {id: foreignCard.id, term: 'stolen', definition: 'thẻ khác'},
      ]),
    ).rejects.toThrow('Card not found in this set.');
  });

  it('creates sets only from vocabulary entries owned by the authenticated user', async () => {
    const ownEntry = await db.vocabEntry.create({
      data: {
        ownerId,
        headword: 'mitigated',
        lemma: `mitigate-${testRun}`,
        partOfSpeech: 'verb',
        meaningVi: 'giảm nhẹ',
      },
    });
    const foreignEntry = await db.vocabEntry.create({
      data: {
        ownerId: otherUserId,
        headword: 'private',
        lemma: `private-${testRun}`,
        partOfSpeech: 'noun',
        meaningVi: 'riêng tư',
      },
    });
    const app = express();
    app.use(express.json());
    app.use('/api/v1', createFlashcardModule(JWT_SECRET).router);
    app.use(errorMiddleware);

    const ownedResult = await request(app)
      .post('/api/v1/flashcards/sets/from-vocab')
      .set('Authorization', `Bearer ${signJwt(ownerId, JWT_SECRET)}`)
      .send({title: 'My words', vocabIds: [ownEntry.id]});
    const foreignResult = await request(app)
      .post('/api/v1/flashcards/sets/from-vocab')
      .set('Authorization', `Bearer ${signJwt(ownerId, JWT_SECRET)}`)
      .send({title: 'Private words', vocabIds: [foreignEntry.id]});

    expect(ownedResult.status).toBe(201);
    expect(ownedResult.body.set.cards).toMatchObject([
      {term: 'mitigated', definition: 'giảm nhẹ', vocabEntryId: ownEntry.id},
    ]);
    expect(foreignResult.status).toBe(404);
  });
  it('lets a user read their own sets and public sets only', async () => {
    const make = (visibility: 'private' | 'public' | 'hidden') =>
      db.flashcardSet.create({data: {ownerId: otherUserId, title: `Readable ${visibility} ${testRun}`, visibility}});
    const [priv, pub, hidden] = [await make('private'), await make('public'), await make('hidden')];

    const read = (userId: string, id: string) => prismaFlashcardRepository.findReadableSet(userId, id);

    expect((await read(ownerId, pub.id))?.id).toBe(pub.id);
    expect((await read(otherUserId, priv.id))?.id).toBe(priv.id);
    expect((await read(otherUserId, hidden.id))?.id).toBe(hidden.id);
    expect(await read(ownerId, priv.id)).toBeNull();
    expect(await read(ownerId, hidden.id)).toBeNull();
  });
});
