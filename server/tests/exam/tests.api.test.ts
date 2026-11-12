import express from 'express';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {
  ApiErrorBody,
  GetTestResponseSchema,
  ListTestsResponseSchema,
  UpdateTestResponseSchema,
} from '@linmaster/shared';
import {getDb} from '../../src/core/db';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {createExamModule} from '../../src/modules/exam';
import {createFixtureTest, testSecrets} from './exam-fixtures';

const JWT_SECRET = 'tests-api-test-secret-that-is-at-least-32-characters';
const testRun = `${Date.now()}`;
const MISSING_ID = '0192f7e0-0bcd-7000-8000-000000000999';
const {answer: ANSWER, explanation: EXPLANATION, transcript: TRANSCRIPT, hiddenKey: HIDDEN_KEY} = testSecrets(testRun);

describe('tests API', () => {
  const db = getDb();
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createExamModule(JWT_SECRET).router);
  app.use(errorMiddleware);
  let ownerId: string;
  let otherId: string;

  const auth = (userId: string) => `Bearer ${signJwt(userId, JWT_SECRET)}`;
  const get = (url: string, userId = ownerId) => request(app).get(url).set('Authorization', auth(userId));

  const createTest = (title: string, data: {ownerId?: string; visibility?: 'private' | 'public' | 'hidden'} = {}) =>
    createFixtureTest({ownerId: data.ownerId ?? ownerId, title, run: testRun, visibility: data.visibility});

  beforeAll(async () => {
    const create = (name: string) =>
      db.user.create({data: {email: `tests-${name}-${testRun}@linmaster.test`, passwordHash: 'x', displayName: name}});
    ownerId = (await create('owner')).id;
    otherId = (await create('other')).id;
  });

  afterAll(async () => {
    const userIds = [ownerId, otherId].filter((id): id is string => id !== undefined);
    if (userIds.length > 0) await db.user.deleteMany({where: {id: {in: userIds}}});
    await db.$disconnect();
  });

  it('lists only my tests, newest first, with their size', async () => {
    const older = await createTest(`Older ${testRun}`);
    const newer = await createTest(`Newer ${testRun}`);
    await createTest(`Foreign ${testRun}`, {ownerId: otherId, visibility: 'public'});

    const response = await get('/api/v1/tests');

    expect(response.status).toBe(200);
    expect(ListTestsResponseSchema.safeParse(response.body).success).toBe(true);
    const ids = response.body.tests.map((test: {id: string}) => test.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    expect(response.body.tests.every((test: {title: string}) => !test.title.startsWith('Foreign'))).toBe(true);
    expect(response.body.tests.find((test: {id: string}) => test.id === newer.id)).toMatchObject({
      kind: 'full',
      skills: ['listening', 'reading'],
      questionCount: 3,
      durationSec: 5400,
      visibility: 'private',
      attemptCount: 0,
    });
  });

  it('never sends answers, explanations, Listening transcripts or unknown jsonb keys', async () => {
    const test = await createTest(`Candidate ${testRun}`);

    const response = await get(`/api/v1/tests/${test.id}`);

    expect(response.status).toBe(200);
    expect(GetTestResponseSchema.safeParse(response.body).success).toBe(true);
    const body = JSON.stringify(response.body);
    for (const secret of [ANSWER, EXPLANATION, TRANSCRIPT, HIDDEN_KEY, '"answer"', '"explanation"']) {
      expect(body).not.toContain(secret);
    }
    const [listening, reading] = response.body.test.sections;
    expect(listening).toMatchObject({skill: 'listening', position: 1, hasAudio: false});
    expect(listening.passages[0]).toMatchObject({paragraphs: null, audioStartSec: 0});
    expect(listening.passages[0].groups[0].questions.map((q: {number: number}) => q.number)).toEqual([1, 2]);
    expect(reading.passages[0].paragraphs).toEqual([{label: 'A', text: 'Farms grow on roofs.'}]);
    expect(reading.passages[0].groups[0]).toMatchObject({shared: {optionsTitle: 'Options'}});
    expect(reading.passages[0].groups[0].questions[0].options).toEqual([{key: 'A', text: 'On roofs'}]);
  });

  it('shows a public test of another user, and hides private and hidden ones', async () => {
    const shared = await createTest(`Public ${testRun}`, {ownerId: otherId, visibility: 'public'});
    const privateTest = await createTest(`Private ${testRun}`, {ownerId: otherId});
    const hidden = await createTest(`Hidden ${testRun}`, {ownerId: otherId, visibility: 'hidden'});

    expect((await get(`/api/v1/tests/${shared.id}`)).status).toBe(200);
    expect((await get(`/api/v1/tests/${privateTest.id}`)).status).toBe(404);
    expect((await get(`/api/v1/tests/${hidden.id}`)).status).toBe(404);
    expect((await get(`/api/v1/tests/${hidden.id}`, otherId)).status).toBe(200);
    expect((await get(`/api/v1/tests/${MISSING_ID}`)).status).toBe(404);
  });

  it('lets only the owner rename a test or change its source', async () => {
    const test = await createTest(`Rename ${testRun}`);
    const patch = (body: object, userId = ownerId) =>
      request(app).patch(`/api/v1/tests/${test.id}`).set('Authorization', auth(userId)).send(body);

    const renamed = await patch({title: `  Renamed ${testRun} `, source: 'Cambridge 18'});
    const cleared = await patch({source: null});
    const foreign = await patch({title: 'Stolen'}, otherId);
    const invalid = await patch({title: 'A', visibility: 'public'});

    expect(renamed.status).toBe(200);
    expect(UpdateTestResponseSchema.safeParse(renamed.body).success).toBe(true);
    expect(renamed.body.test).toMatchObject({title: `Renamed ${testRun}`, source: 'Cambridge 18', questionCount: 3});
    expect(cleared.body.test).toMatchObject({title: `Renamed ${testRun}`, source: null});
    expect(foreign.status).toBe(404);
    expect(invalid.status).toBe(400);
    expect((await db.test.findUnique({where: {id: test.id}}))?.visibility).toBe('private');
  });

  it('deletes a test without attempts of others, and answers 409 TEST_HAS_ATTEMPTS otherwise', async () => {
    const free = await createTest(`Free ${testRun}`);
    const taken = await createTest(`Taken ${testRun}`);
    await db.test.update({where: {id: taken.id}, data: {attemptCount: 1}});
    const remove = (id: string, userId = ownerId) =>
      request(app).delete(`/api/v1/tests/${id}`).set('Authorization', auth(userId));

    const foreign = await remove(free.id, otherId);
    const deleted = await remove(free.id);
    const again = await remove(free.id);
    const blocked = await remove(taken.id);

    expect(foreign.status).toBe(404);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({deleted: true});
    expect(await db.test.findUnique({where: {id: free.id}})).toBeNull();
    expect(await db.question.count({where: {group: {passage: {section: {testId: free.id}}}}})).toBe(0);
    expect(again.status).toBe(404);
    expect(blocked.status).toBe(409);
    expect(ApiErrorBody.safeParse(blocked.body).success).toBe(true);
    expect(blocked.body.error.status).toBe('TEST_HAS_ATTEMPTS');
    expect(await db.test.findUnique({where: {id: taken.id}})).not.toBeNull();
  });

  it('validates the id and needs a signed-in user', async () => {
    expect((await get('/api/v1/tests/not-a-uuid')).status).toBe(400);
    expect((await request(app).get('/api/v1/tests')).status).toBe(401);
    expect((await request(app).get(`/api/v1/tests/${MISSING_ID}`)).status).toBe(401);
    expect((await request(app).delete(`/api/v1/tests/${MISSING_ID}`)).status).toBe(401);
  });
});
