import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {Rating} from '@linmaster/shared';
import {getDb} from '../../src/core/db';
import {scheduleReview} from '../../src/modules/flashcard/flashcard.scheduler';
import {prismaFlashcardRepository} from '../../src/modules/flashcard/flashcard.repository';
import {prismaStudyRepository as repo} from '../../src/modules/flashcard/study.repository';

const testRun = `${Date.now()}`;
const ownerEmail = `study-owner-${testRun}@linmaster.test`;
const otherEmail = `study-other-${testRun}@linmaster.test`;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Prisma study repository', () => {
  const db = getDb();
  let ownerId: string;
  let otherUserId: string;

  beforeAll(async () => {
    ownerId = (await db.user.create({data: {email: ownerEmail, passwordHash: 'x', displayName: 'Study owner'}})).id;
    otherUserId = (await db.user.create({data: {email: otherEmail, passwordHash: 'x', displayName: 'Study other'}})).id;
  });

  afterAll(async () => {
    const userIds = [ownerId, otherUserId].filter((id): id is string => id !== undefined);
    if (userIds.length > 0) await db.user.deleteMany({where: {id: {in: userIds}}});
    await db.$disconnect();
  });

  async function createSet(userId: string, title: string, termCount: number) {
    const set = await prismaFlashcardRepository.createSet(userId, {title, termLang: 'en', definitionLang: 'vi'});
    const cards = await prismaFlashcardRepository.replaceCards(
      userId,
      set.id,
      Array.from({length: termCount}, (_, i) => ({term: `term ${i}`, definition: `definition ${i}`})),
    );
    return {set, cards: cards!};
  }

  const rate = (userId: string, cardId: string, rating: Rating, now: Date, sessionId: string | null = null) =>
    repo.reviewCard(userId, cardId, {
      rating,
      sessionId,
      now,
      schedule: previous => scheduleReview(previous, rating, now),
    });

  it('creates progress on the first rating, updates it after, and logs every rating', async () => {
    const {cards} = await createSet(ownerId, `Review ${testRun}`, 1);
    const now = new Date('2026-11-10T03:00:00.000Z');

    const first = await rate(ownerId, cards[0].id, 'good', now);
    const second = await rate(ownerId, cards[0].id, 'good', new Date(now.getTime() + DAY_MS));

    expect(first).toMatchObject({intervalDays: 1, repetitions: 1, lastReviewedAt: now});
    expect(second).toMatchObject({intervalDays: 6, repetitions: 2});
    expect(await db.cardProgress.count({where: {userId: ownerId, cardId: cards[0].id}})).toBe(1);
    const logs = await db.reviewLog.findMany({where: {cardId: cards[0].id}, orderBy: {reviewedAt: 'asc'}});
    expect(logs.map(log => [log.intervalBefore, log.intervalAfter])).toEqual([
      [0, 1],
      [1, 6],
    ]);
    expect(logs[0].reviewedAt).toEqual(now);
  });

  it('lists new cards in order without rated ones, and due cards before a cut-off', async () => {
    const {set, cards} = await createSet(ownerId, `Lists ${testRun}`, 4);
    const now = new Date('2026-11-10T03:00:00.000Z');
    await rate(ownerId, cards[1].id, 'good', now); // due now + 1 day
    await rate(ownerId, cards[2].id, 'again', new Date(now.getTime() - DAY_MS)); // due now

    const fresh = await repo.listNewCards(ownerId, set.id, 10);
    const dueSoon = await repo.listDueCards(ownerId, set.id, new Date(now.getTime() + DAY_MS / 2), 10);
    const dueLater = await repo.listDueCards(ownerId, set.id, new Date(now.getTime() + 2 * DAY_MS), 10);

    expect(fresh.map(card => card.id)).toEqual([cards[0].id, cards[3].id]);
    expect(await repo.listNewCards(ownerId, set.id, 1)).toHaveLength(1);
    expect(await repo.listNewCards(ownerId, set.id, 0)).toEqual([]);
    expect(dueSoon.map(item => item.card.id)).toEqual([cards[2].id]);
    expect(dueLater.map(item => item.card.id)).toEqual([cards[2].id, cards[1].id]);
    // Another learner neither sees the set nor gets its cards.
    expect(await repo.isSetOwner(otherUserId, set.id)).toBe(false);
    expect(await repo.listNewCards(otherUserId, set.id, 10)).toEqual([]);
    expect(await repo.findCardSetId(otherUserId, cards[0].id)).toBeNull();
    expect(await repo.findCardSetId(ownerId, cards[0].id)).toBe(set.id);
  });

  it('counts only cards whose first ever rating is inside the day', async () => {
    const {set, cards} = await createSet(ownerId, `New today ${testRun}`, 3);
    const dayStart = new Date('2026-11-09T17:00:00.000Z');
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    await rate(ownerId, cards[0].id, 'good', new Date(dayStart.getTime() - DAY_MS)); // started yesterday
    await rate(ownerId, cards[0].id, 'good', new Date(dayStart.getTime() + 60_000));
    await rate(ownerId, cards[1].id, 'again', new Date(dayStart.getTime() + 120_000)); // started today
    await rate(ownerId, cards[1].id, 'good', new Date(dayStart.getTime() + 180_000));

    expect(await repo.countNewCardsStarted(ownerId, set.id, dayStart, dayEnd)).toBe(1);
    expect(await repo.countNewCardsStarted(otherUserId, set.id, dayStart, dayEnd)).toBe(0);
  });

  it('closes a session once and lists its ratings', async () => {
    const {set, cards} = await createSet(ownerId, `Session ${testRun}`, 1);
    const now = new Date('2026-11-10T03:00:00.000Z');
    const session = await repo.createSession(ownerId, set.id, 'learn', now);
    await rate(ownerId, cards[0].id, 'again', now, session.id);
    await rate(ownerId, cards[0].id, 'good', new Date(now.getTime() + 1000), session.id);

    expect(await repo.listSessionReviews(session.id)).toEqual([
      {cardId: cards[0].id, rating: 'again'},
      {cardId: cards[0].id, rating: 'good'},
    ]);
    expect(await repo.findSession(otherUserId, session.id)).toBeNull();
    expect(await repo.endSession(otherUserId, session.id, {cardsStudied: 1, correctCount: 1}, now)).toBeNull();

    const ended = await repo.endSession(ownerId, session.id, {cardsStudied: 1, correctCount: 1}, now);
    expect(ended).toMatchObject({cardsStudied: 1, correctCount: 1, endedAt: now});
    expect(await repo.endSession(ownerId, session.id, {cardsStudied: 5, correctCount: 5}, now)).toBeNull();
  });

  it('counts due cards per owned set only', async () => {
    const first = await createSet(ownerId, `Due A ${testRun}`, 2);
    const second = await createSet(ownerId, `Due B ${testRun}`, 1);
    const foreign = await createSet(otherUserId, `Due foreign ${testRun}`, 1);
    const past = new Date('2026-01-01T00:00:00.000Z');
    for (const card of [...first.cards, ...second.cards]) await rate(ownerId, card.id, 'good', past);
    await rate(otherUserId, foreign.cards[0].id, 'good', past);
    const cutOff = new Date('2026-06-01T00:00:00.000Z');

    const counts = await repo.dueSetCounts(ownerId, cutOff);
    const mine = counts.filter(count => [first.set.id, second.set.id].includes(count.setId));

    expect(mine).toEqual(
      expect.arrayContaining([
        {setId: first.set.id, title: `Due A ${testRun}`, dueCount: 2},
        {setId: second.set.id, title: `Due B ${testRun}`, dueCount: 1},
      ]),
    );
    expect(counts.some(count => count.setId === foreign.set.id)).toBe(false);
    expect(await repo.dueSetCounts(ownerId, past)).toEqual([]);
  });
});
