import {
  StatsActivityResponseSchema,
  StatsBandsResponseSchema,
  StatsCommunityResponseSchema,
  StatsOverviewResponseSchema,
  StatsVocabResponseSchema,
  StatsWeaknessesResponseSchema,
} from '@linmaster/shared';
import express from 'express';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {ZodType} from 'zod';

import {seedSampleTests} from '../../prisma/seed-tests';
import {getDb} from '../../src/core/db';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {generateOpenApiDocument} from '../../src/core/openapi-registry';
import {createStatsModule} from '../../src/modules/stats';

const JWT_SECRET = 'stats-test-secret-that-is-at-least-32-characters';
const run = `${Date.now()}`;
const ENDPOINTS: Array<[string, ZodType]> = [
  ['overview', StatsOverviewResponseSchema],
  ['activity', StatsActivityResponseSchema],
  ['bands', StatsBandsResponseSchema],
  ['vocab', StatsVocabResponseSchema],
  ['weaknesses', StatsWeaknessesResponseSchema],
  ['community', StatsCommunityResponseSchema],
];

// Real database and the real public APIs of vocab, flashcard, exam and auth.
describe('stats API', () => {
  const db = getDb();
  const app = express();
  app.use(createStatsModule(JWT_SECRET).router);
  app.use(errorMiddleware);
  let ownerId: string;
  let newUserId: string;

  const get = (path: string, userId: string) =>
    request(app)
      .get(`/stats/${path}`)
      .set('Authorization', `Bearer ${signJwt(userId, JWT_SECRET)}`);

  beforeAll(async () => {
    const user = (email: string, targetBand: number | null) =>
      db.user.create({data: {email, passwordHash: 'x', displayName: 'Stats', targetBand}});
    ownerId = (await user(`stats-owner-${run}@linmaster.test`, 7)).id;
    newUserId = (await user(`stats-new-${run}@linmaster.test`, null)).id;

    // Same kind of data as the demo seed: saved words, a set studied from them, the sample tests and one attempt.
    const words = await Promise.all(
      [
        {headword: 'mitigate', topics: ['environment']},
        {headword: 'curb', topics: ['environment', 'politics']},
      ].map(({headword, topics}) =>
        db.vocabEntry.create({
          data: {ownerId, headword, lemma: headword, partOfSpeech: 'verb', meaningVi: '-', topics, collocations: []},
        }),
      ),
    );
    await db.vocabLookup.create({data: {ownerId, text: 'mitigate', sentence: 'Trees mitigate heat.', saved: true}});
    // Published and copied twice by others (library P4-02 keeps copyCount on the set).
    const set = await db.flashcardSet.create({
      data: {ownerId, title: 'Words', visibility: 'public', publishedAt: new Date(), copyCount: 2},
    });
    await db.flashcardSet.create({data: {ownerId, title: 'Private'}});
    const card = await db.card.create({
      data: {setId: set.id, position: 0, term: 'mitigate', definition: '-', vocabEntryId: words[0].id},
    });
    await db.cardProgress.create({data: {userId: ownerId, cardId: card.id, intervalDays: 25, dueAt: new Date()}});
    await db.reviewLog.create({
      data: {userId: ownerId, cardId: card.id, rating: 'good', intervalBefore: 6, intervalAfter: 25},
    });
    const started = new Date(Date.now() - 20 * 60 * 1000);
    await db.studySession.create({
      data: {userId: ownerId, setId: set.id, mode: 'flip', startedAt: started, endedAt: new Date()},
    });

    await seedSampleTests(db, ownerId);
    const test = await db.test.update({
      where: {id: (await db.test.findFirstOrThrow({where: {ownerId, kind: 'reading'}})).id},
      data: {visibility: 'public', publishedAt: new Date(), attemptCount: 3},
    });
    const answers = [true, false, false, true, false].map((isCorrect, index) => ({
      questionNumber: index + 1,
      skill: 'reading' as const,
      kind: 'tfng' as const,
      given: 'TRUE',
      correctAnswer: {value: 'TRUE'},
      isCorrect,
    }));
    await db.attempt.create({
      data: {
        userId: ownerId,
        testId: test.id,
        status: 'submitted',
        startedAt: started,
        deadlineAt: new Date(),
        submittedAt: new Date(),
        state: {},
        readingCorrect: 2,
        readingBand: 6.5,
        answers: {create: answers},
      },
    });
  });

  afterAll(async () => {
    await db.user.deleteMany({where: {id: {in: [ownerId, newUserId].filter(Boolean)}}});
    await db.$disconnect();
  });

  it('shows the owner their own numbers', async () => {
    const overview = (await get('overview', ownerId).expect(200)).body;
    expect(overview).toMatchObject({
      testsTaken: 1,
      bands: {reading: {best: 6.5, latest: 6.5}, listening: {best: null, latest: null}},
      targetBand: 7,
      words: 2,
      masteredWords: 1,
      cardsReviewed: 1,
      streak: {current: 1, longest: 1},
    });
    expect(overview.studyMinutes).toBeGreaterThanOrEqual(39);

    const activity = (await get('activity', ownerId).expect(200)).body;
    expect(activity.days).toHaveLength(1);
    expect(activity.days[0]).toMatchObject({lookups: 1, savedWords: 2, reviews: 1, attempts: 1, total: 5});

    const bands = (await get('bands', ownerId).expect(200)).body;
    expect(bands).toMatchObject({targetBand: 7, points: [{reading: 6.5, listening: null}]});

    const vocab = (await get('vocab', ownerId).expect(200)).body;
    expect(vocab).toMatchObject({total: 2, states: {new: 1, learning: 0, mastered: 1}});
    expect(vocab.topics[0]).toEqual({topic: 'environment', words: 2});

    expect((await get('community', ownerId).expect(200)).body).toEqual({
      publishedSets: 1,
      setCopies: 2,
      publishedTests: 1,
      testAttempts: 3,
    });

    const weaknesses = (await get('weaknesses', ownerId).expect(200)).body;
    expect(weaknesses).toEqual({
      kinds: [{skill: 'reading', kind: 'tfng', answered: 5, correct: 2, accuracy: 0.4}],
      weakest: {skill: 'reading', kind: 'tfng'},
    });
  });

  it.each(ENDPOINTS)('gives another or new account a valid empty %s, never the owner data', async (path, schema) => {
    const body = schema.parse((await get(path, newUserId).expect(200)).body);
    expect(JSON.stringify(body)).not.toContain('environment');
    expect(body).not.toMatchObject({testsTaken: 1});
  });

  it('answers 401 without a token and 400 for a bad range', async () => {
    for (const [path] of ENDPOINTS) await request(app).get(`/stats/${path}`).expect(401);
    await get('activity?from=2026-11-14&to=2026-11-01', ownerId).expect(400);
    await get('activity?from=14-11-2026', ownerId).expect(400);
    await get('activity?userId=x', ownerId).expect(400);
  });

  it('documents every endpoint in Swagger with bearer auth', () => {
    const paths = generateOpenApiDocument().paths ?? {};
    for (const [path] of ENDPOINTS) {
      expect(paths[`/api/v1/stats/${path}`]?.get).toMatchObject({security: [{bearerAuth: []}]});
    }
  });
});
