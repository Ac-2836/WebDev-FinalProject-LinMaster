import express from 'express';
import request from 'supertest';
import {beforeEach, describe, expect, it} from 'vitest';
import {NEW_CARDS_PER_DAY, type FlashcardCard, type Rating, type StudyMode} from '@linmaster/shared';
import {errorMiddleware} from '../../src/core/error.middleware';
import {generateOpenApiDocument} from '../../src/core/openapi-registry';
import {signJwt} from '../../src/core/jwt';
import {createFlashcardModule} from '../../src/modules/flashcard';
import type {FlashcardRepository} from '../../src/modules/flashcard/flashcard.repository';
import type {
  ProgressRecord,
  SessionRecord,
  StudyCardRecord,
  StudyRepository,
} from '../../src/modules/flashcard/study.repository';

const JWT_SECRET = 'study-test-secret-that-is-at-least-32-characters';
const OWNER_ID = '0192f7e0-0bcd-7000-8000-000000000101';
const OTHER_USER_ID = '0192f7e0-0bcd-7000-8000-000000000102';
const SET_ID = '0192f7e0-0bcd-7000-8000-000000000103';
const OTHER_SET_ID = '0192f7e0-0bcd-7000-8000-000000000104';
const CARD_ID = '0192f7e0-0bcd-7000-8000-000000000105';
const OTHER_SET_CARD_ID = '0192f7e0-0bcd-7000-8000-000000000106';
const MISSING_ID = '0192f7e0-0bcd-7000-8000-000000000199';
// 23:30 in Vietnam on 10 Nov: "today" ends at 2026-11-10T17:00Z.
const NOW = new Date('2026-11-10T16:30:00.000Z');
const END_OF_VIETNAM_DAY = new Date('2026-11-10T17:00:00.000Z');
const START_OF_VIETNAM_DAY = new Date('2026-11-09T17:00:00.000Z');

function makeCard(id: string, position: number): FlashcardCard {
  return {
    id,
    term: `term ${position}`,
    definition: `definition ${position}`,
    example: null,
    vocabEntryId: null,
    position,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

function cardId(n: number) {
  return `0192f7e0-0bcd-7000-8000-${String(200 + n).padStart(12, '0')}`;
}

/** In-memory study repository: one owned set (SET_ID) and one owned by someone else (OTHER_SET_ID). */
function makeRepository() {
  const sets = new Map([
    [SET_ID, {ownerId: OWNER_ID, title: 'Owner set'}],
    [OTHER_SET_ID, {ownerId: OTHER_USER_ID, title: 'Other set'}],
  ]);
  const cards = new Map<string, {setId: string; card: FlashcardCard}>([
    [CARD_ID, {setId: SET_ID, card: makeCard(CARD_ID, 0)}],
    [OTHER_SET_CARD_ID, {setId: OTHER_SET_ID, card: makeCard(OTHER_SET_CARD_ID, 0)}],
  ]);
  const progress = new Map<string, ProgressRecord>();
  const sessions = new Map<string, SessionRecord & {userId: string}>();
  const reviews: Array<{cardId: string; rating: Rating; sessionId: string | null}> = [];
  const calls = {dueBefore: [] as Date[], newStarted: [] as Array<[Date, Date]>};
  let newCardsStartedToday = 0;
  let sessionNumber = 0;

  const repository: StudyRepository = {
    async isSetOwner(ownerId, setId) {
      return sets.get(setId)?.ownerId === ownerId;
    },
    async listDueCards(_userId, setId, dueBefore, limit) {
      calls.dueBefore.push(dueBefore);
      const due: StudyCardRecord[] = [...progress.values()]
        .filter(item => cards.get(item.cardId)?.setId === setId && item.dueAt < dueBefore)
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
        .map(item => ({card: cards.get(item.cardId)!.card, progress: item}));
      return due.slice(0, limit);
    },
    async listNewCards(_userId, setId, limit) {
      return [...cards.values()]
        .filter(item => item.setId === setId && !progress.has(item.card.id))
        .map(item => item.card)
        .sort((a, b) => a.position - b.position)
        .slice(0, limit);
    },
    async countNewCardsStarted(_userId, _setId, from, to) {
      calls.newStarted.push([from, to]);
      return newCardsStartedToday;
    },
    async findCardSetId(userId, id) {
      const item = cards.get(id);
      return item && sets.get(item.setId)?.ownerId === userId ? item.setId : null;
    },
    async reviewCard(_userId, id, {rating, sessionId, now, schedule}) {
      const next = schedule(progress.get(id) ?? null);
      const saved: ProgressRecord = {cardId: id, ...next, lastReviewedAt: now};
      progress.set(id, saved);
      reviews.push({cardId: id, rating, sessionId});
      return saved;
    },
    async createSession(userId, setId, mode: StudyMode, now) {
      sessionNumber += 1;
      const session = {
        id: `0192f7e0-0bcd-7000-8000-${String(300 + sessionNumber).padStart(12, '0')}`,
        userId,
        setId,
        mode,
        startedAt: now,
        endedAt: null,
        cardsStudied: 0,
        correctCount: 0,
      };
      sessions.set(session.id, session);
      return session;
    },
    async findSession(userId, id) {
      const session = sessions.get(id);
      return session?.userId === userId ? session : null;
    },
    async listSessionReviews(sessionId) {
      return reviews.filter(review => review.sessionId === sessionId);
    },
    async endSession(userId, id, counts, now) {
      const session = sessions.get(id);
      if (session?.userId !== userId || session.endedAt) return null;
      const ended = {...session, ...counts, endedAt: now};
      sessions.set(id, ended);
      return ended;
    },
    async dueSetCounts(userId, dueBefore) {
      calls.dueBefore.push(dueBefore);
      const counts = new Map<string, number>();
      for (const item of progress.values()) {
        const setId = cards.get(item.cardId)!.setId;
        if (sets.get(setId)?.ownerId === userId && item.dueAt < dueBefore) {
          counts.set(setId, (counts.get(setId) ?? 0) + 1);
        }
      }
      return [...counts].map(([setId, dueCount]) => ({setId, title: sets.get(setId)!.title, dueCount}));
    },
  };

  return {
    repository,
    sets,
    cards,
    progress,
    calls,
    setNewCardsStartedToday(count: number) {
      newCardsStartedToday = count;
    },
  };
}

// Set CRUD is covered by flashcard.test.ts; these tests never reach it.
const unusedSetRepository = {} as FlashcardRepository;
const unusedVocab = {getEntriesForUser: async () => []};

function authHeader(userId = OWNER_ID) {
  return `Bearer ${signJwt(userId, JWT_SECRET)}`;
}

describe('flashcard study API', () => {
  let store: ReturnType<typeof makeRepository>;
  let app: express.Express;

  beforeEach(() => {
    store = makeRepository();
    app = express();
    app.use(express.json());
    app.use(createFlashcardModule(JWT_SECRET, unusedSetRepository, unusedVocab, store.repository, () => NOW).router);
    app.use(errorMiddleware);
  });

  const startSession = (mode: StudyMode, setId = SET_ID, userId = OWNER_ID) =>
    request(app).post('/flashcards/sessions').set('Authorization', authHeader(userId)).send({setId, mode});
  const review = (body: object, userId = OWNER_ID) =>
    request(app).post('/flashcards/reviews').set('Authorization', authHeader(userId)).send(body);
  const endSession = (id: string, body: object = {}) =>
    request(app).patch(`/flashcards/sessions/${id}`).set('Authorization', authHeader()).send(body);

  it('requires authentication on every study route', async () => {
    const responses = await Promise.all([
      request(app).get(`/flashcards/sets/${SET_ID}/study`),
      request(app).post('/flashcards/reviews').send({cardId: CARD_ID, rating: 'good'}),
      request(app).post('/flashcards/sessions').send({setId: SET_ID, mode: 'learn'}),
      request(app).patch(`/flashcards/sessions/${MISSING_ID}`).send({}),
      request(app).get('/flashcards/due-summary'),
    ]);
    expect(responses.map(response => response.status)).toEqual([401, 401, 401, 401, 401]);
  });

  describe('GET /flashcards/sets/:id/study', () => {
    it('returns due cards first, then new cards, using the end of the Vietnam day', async () => {
      const newCardId = cardId(1);
      store.cards.set(newCardId, {setId: SET_ID, card: makeCard(newCardId, 1)});
      store.progress.set(CARD_ID, {
        cardId: CARD_ID,
        easiness: 2.5,
        intervalDays: 1,
        repetitions: 1,
        lapses: 0,
        // Due later tonight, still "today" in Vietnam.
        dueAt: new Date('2026-11-10T16:50:00.000Z'),
        lastReviewedAt: new Date('2026-11-09T16:50:00.000Z'),
      });

      const response = await request(app).get(`/flashcards/sets/${SET_ID}/study`).set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(response.body.cards.map((card: {id: string}) => card.id)).toEqual([CARD_ID, newCardId]);
      expect(response.body.cards[0]).toMatchObject({state: 'learning', progress: {repetitions: 1}});
      expect(response.body.cards[1]).toMatchObject({state: 'new', progress: null});
      expect(response.body).toMatchObject({dueCount: 1, newCount: 1, newCardsPerDay: NEW_CARDS_PER_DAY});
      expect(store.calls.dueBefore).toEqual([END_OF_VIETNAM_DAY]);
      expect(store.calls.newStarted).toEqual([[START_OF_VIETNAM_DAY, END_OF_VIETNAM_DAY]]);
    });

    it('does not return cards due after the Vietnam midnight', async () => {
      store.progress.set(CARD_ID, {
        cardId: CARD_ID,
        easiness: 2.5,
        intervalDays: 1,
        repetitions: 1,
        lapses: 0,
        dueAt: new Date('2026-11-10T17:00:00.000Z'),
        lastReviewedAt: NOW,
      });

      const response = await request(app).get(`/flashcards/sets/${SET_ID}/study`).set('Authorization', authHeader());

      expect(response.body).toMatchObject({cards: [], dueCount: 0, newCount: 0});
    });

    it('limits new cards to what is left of the daily allowance', async () => {
      for (let n = 1; n <= NEW_CARDS_PER_DAY + 5; n++) {
        store.cards.set(cardId(n), {setId: SET_ID, card: makeCard(cardId(n), n)});
      }
      store.setNewCardsStartedToday(NEW_CARDS_PER_DAY - 3);

      const response = await request(app).get(`/flashcards/sets/${SET_ID}/study`).set('Authorization', authHeader());

      expect(response.body).toMatchObject({newCount: 3, newCardsRemaining: 0});
      expect(response.body.cards.map((card: {position: number}) => card.position)).toEqual([0, 1, 2]);

      store.setNewCardsStartedToday(NEW_CARDS_PER_DAY + 2);
      const exhausted = await request(app).get(`/flashcards/sets/${SET_ID}/study`).set('Authorization', authHeader());
      expect(exhausted.body).toMatchObject({cards: [], newCount: 0, newCardsRemaining: 0});
    });

    it('hides another owner set', async () => {
      const response = await request(app)
        .get(`/flashcards/sets/${OTHER_SET_ID}/study`)
        .set('Authorization', authHeader());
      expect(response.status).toBe(404);
    });
  });

  describe('POST /flashcards/reviews', () => {
    it('applies SM-2 to the card and links the review to the learn session', async () => {
      const session = (await startSession('learn')).body.session;

      const first = await review({cardId: CARD_ID, rating: 'good', sessionId: session.id});
      const second = await review({cardId: CARD_ID, rating: 'good', sessionId: session.id});

      expect(first.status).toBe(200);
      expect(first.body.progress).toMatchObject({
        cardId: CARD_ID,
        intervalDays: 1,
        repetitions: 1,
        state: 'learning',
        dueAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        lastReviewedAt: NOW.toISOString(),
      });
      expect(second.body.progress).toMatchObject({intervalDays: 6, repetitions: 2});
    });

    it('works without a session', async () => {
      const response = await review({cardId: CARD_ID, rating: 'easy'});
      expect(response.status).toBe(200);
      expect(response.body.progress).toMatchObject({easiness: 2.6, repetitions: 1});
    });

    it('rejects a card of someone else, an unknown session and a bad rating', async () => {
      expect((await review({cardId: OTHER_SET_CARD_ID, rating: 'good'})).status).toBe(404);
      expect((await review({cardId: CARD_ID, rating: 'good', sessionId: MISSING_ID})).status).toBe(404);
      expect((await review({cardId: CARD_ID, rating: 'perfect'})).status).toBe(400);
      expect(store.progress.size).toBe(0);
    });

    it('refuses ratings in an ended session, a non-learn session or a session of another set', async () => {
      const ended = (await startSession('learn')).body.session;
      await endSession(ended.id);
      const flip = (await startSession('flip')).body.session;
      const otherSetCard = cardId(9);
      store.sets.set(cardId(8), {ownerId: OWNER_ID, title: 'Second set'});
      store.cards.set(otherSetCard, {setId: cardId(8), card: makeCard(otherSetCard, 0)});
      const learn = (await startSession('learn')).body.session;

      expect((await review({cardId: CARD_ID, rating: 'good', sessionId: ended.id})).status).toBe(409);
      expect((await review({cardId: CARD_ID, rating: 'good', sessionId: flip.id})).status).toBe(409);
      expect((await review({cardId: otherSetCard, rating: 'good', sessionId: learn.id})).status).toBe(400);
      expect(store.progress.size).toBe(0);
    });
  });

  describe('study sessions', () => {
    it('starts a session on an owned set only', async () => {
      const created = await startSession('flip');
      expect(created.status).toBe(201);
      expect(created.body.session).toMatchObject({setId: SET_ID, mode: 'flip', endedAt: null, cardsStudied: 0});
      expect((await startSession('flip', OTHER_SET_ID)).status).toBe(404);
      expect((await startSession('learn', SET_ID, OTHER_USER_ID)).status).toBe(404);
    });

    it('counts a learn session from its ratings and ignores client counts', async () => {
      const secondCard = cardId(1);
      store.cards.set(secondCard, {setId: SET_ID, card: makeCard(secondCard, 1)});
      const session = (await startSession('learn')).body.session;
      await review({cardId: CARD_ID, rating: 'again', sessionId: session.id});
      await review({cardId: secondCard, rating: 'again', sessionId: session.id});
      await review({cardId: CARD_ID, rating: 'good', sessionId: session.id});

      const ended = await endSession(session.id, {cardsStudied: 99, correctCount: 99});

      expect(ended.status).toBe(200);
      expect(ended.body.session).toMatchObject({cardsStudied: 2, correctCount: 1, endedAt: NOW.toISOString()});
    });

    it('stores client counts for other modes and closes a session only once', async () => {
      const session = (await startSession('flip')).body.session;

      const ended = await endSession(session.id, {cardsStudied: 12, correctCount: 9});
      const again = await endSession(session.id, {cardsStudied: 12});

      expect(ended.body.session).toMatchObject({mode: 'flip', cardsStudied: 12, correctCount: 9});
      expect(again.status).toBe(409);
    });

    it('rejects inconsistent counts and unknown sessions', async () => {
      const session = (await startSession('test')).body.session;
      expect((await endSession(session.id, {cardsStudied: 3, correctCount: 4})).status).toBe(400);
      expect((await endSession(MISSING_ID)).status).toBe(404);

      const someoneElse = await request(app)
        .patch(`/flashcards/sessions/${session.id}`)
        .set('Authorization', authHeader(OTHER_USER_ID))
        .send({});
      expect(someoneElse.status).toBe(404);
    });
  });

  describe('GET /flashcards/due-summary', () => {
    it('sums due cards over the learner sets, most due first', async () => {
      const secondSet = cardId(50);
      store.sets.set(secondSet, {ownerId: OWNER_ID, title: 'Busy set'});
      const due = {easiness: 2.5, intervalDays: 1, repetitions: 1, lapses: 0, dueAt: NOW, lastReviewedAt: NOW};
      store.progress.set(CARD_ID, {cardId: CARD_ID, ...due});
      for (const n of [51, 52]) {
        store.cards.set(cardId(n), {setId: secondSet, card: makeCard(cardId(n), n)});
        store.progress.set(cardId(n), {cardId: cardId(n), ...due});
      }
      store.progress.set(OTHER_SET_CARD_ID, {cardId: OTHER_SET_CARD_ID, ...due});

      const response = await request(app).get('/flashcards/due-summary').set('Authorization', authHeader());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        dueCount: 3,
        sets: [
          {setId: secondSet, title: 'Busy set', dueCount: 2},
          {setId: SET_ID, title: 'Owner set', dueCount: 1},
        ],
      });
      expect(store.calls.dueBefore).toEqual([END_OF_VIETNAM_DAY]);
    });

    it('is empty for a learner with nothing due', async () => {
      const response = await request(app).get('/flashcards/due-summary').set('Authorization', authHeader());
      expect(response.body).toEqual({dueCount: 0, sets: []});
    });
  });

  it('documents every study route with bearer authentication', () => {
    const paths = generateOpenApiDocument().paths ?? {};
    const security = {security: [{bearerAuth: []}]};

    expect(paths['/api/v1/flashcards/sets/{id}/study']?.get).toMatchObject(security);
    expect(paths['/api/v1/flashcards/reviews']?.post).toMatchObject(security);
    expect(paths['/api/v1/flashcards/sessions']?.post).toMatchObject(security);
    expect(paths['/api/v1/flashcards/sessions/{id}']?.patch).toMatchObject(security);
    expect(paths['/api/v1/flashcards/due-summary']?.get).toMatchObject(security);
  });
});
