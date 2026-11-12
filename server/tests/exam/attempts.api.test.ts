import express from 'express';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {
  ApiErrorBody,
  CreateAttemptResponseSchema,
  EMPTY_ATTEMPT_STATE,
  GetAttemptResponseSchema,
  SaveAttemptStateResponseSchema,
} from '@linmaster/shared';
import {getDb} from '../../src/core/db';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {createExamModule} from '../../src/modules/exam';
import {createFixtureTest, testSecrets} from './exam-fixtures';

const JWT_SECRET = 'attempts-api-test-secret-that-is-at-least-32-characters';
const testRun = `${Date.now()}`;
const MISSING_ID = '0192f7e0-0bcd-7000-8000-000000000999';
const START = new Date('2026-11-13T03:00:00.000Z');
const MINUTE = 60_000;

describe('attempts API', () => {
  const db = getDb();
  let clock = START;
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createExamModule(JWT_SECRET, {now: () => clock}).router);
  app.use(errorMiddleware);
  let ownerId: string;
  let otherId: string;
  let audioFileId: string;

  const auth = (userId: string) => `Bearer ${signJwt(userId, JWT_SECRET)}`;
  const start = (testId: string, userId = ownerId) =>
    request(app).post('/api/v1/attempts').set('Authorization', auth(userId)).send({testId});
  const get = (id: string, userId = ownerId) =>
    request(app).get(`/api/v1/attempts/${id}`).set('Authorization', auth(userId));
  const save = (id: string, state: object, userId = ownerId) =>
    request(app).put(`/api/v1/attempts/${id}/state`).set('Authorization', auth(userId)).send({state});
  const createTest = (title: string, visibility: 'private' | 'public' = 'private') =>
    createFixtureTest({ownerId, title: `${title} ${testRun}`, run: testRun, visibility, audioFileId});

  beforeAll(async () => {
    const create = (name: string) =>
      db.user.create({
        data: {email: `attempts-${name}-${testRun}@linmaster.test`, passwordHash: 'x', displayName: name},
      });
    ownerId = (await create('owner')).id;
    otherId = (await create('other')).id;
    const audio = await db.storedFile.create({
      data: {
        ownerId,
        storageKey: `attempts-${testRun}.mp3`,
        mimeType: 'audio/mpeg',
        sizeBytes: 1,
        originalName: 'audio.mp3',
        durationSec: 1680,
      },
    });
    audioFileId = audio.id;
  });

  beforeEach(() => {
    clock = START;
  });

  afterAll(async () => {
    const userIds = [ownerId, otherId].filter((id): id is string => id !== undefined);
    if (userIds.length > 0) await db.user.deleteMany({where: {id: {in: userIds}}});
    await db.$disconnect();
  });

  it('starts an attempt with a server deadline, and returns it again while in progress', async () => {
    const test = await createTest('Start');

    const created = await start(test.id);
    clock = new Date(START.getTime() + MINUTE);
    const again = await start(test.id);

    expect(created.status).toBe(201);
    expect(CreateAttemptResponseSchema.safeParse(created.body).success).toBe(true);
    expect(created.body.attempt).toMatchObject({
      testId: test.id,
      status: 'in_progress',
      startedAt: START.toISOString(),
      deadlineAt: new Date(START.getTime() + 90 * MINUTE).toISOString(),
      remainingSec: 5400,
      state: EMPTY_ATTEMPT_STATE,
    });
    expect(again.status).toBe(200);
    expect(again.body.attempt).toMatchObject({id: created.body.attempt.id, remainingSec: 5340});
    expect((await db.test.findUnique({where: {id: test.id}}))?.attemptCount).toBe(0);
  });

  it('never sends answers, explanations or Listening transcripts with the attempt', async () => {
    const test = await createTest('Secrets');
    const {id} = (await start(test.id)).body.attempt;

    const body = JSON.stringify((await get(id)).body);

    const secrets = testSecrets(testRun);
    for (const secret of [...Object.values(secrets), '"answer"', '"explanation"']) {
      expect(body).not.toContain(secret);
    }
  });

  it('lets others start a public test once, counted in attemptCount, but not a private one', async () => {
    const shared = await createTest('Public', 'public');
    const privateTest = await createTest('Private');

    const [first, second] = await Promise.all([start(shared.id, otherId), start(shared.id, otherId)]);
    const hidden = await start(privateTest.id, otherId);

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.attempt.id).toBe(second.body.attempt.id);
    expect((await db.test.findUnique({where: {id: shared.id}}))?.attemptCount).toBe(1);
    expect(hidden.status).toBe(404);
    expect((await start(MISSING_ID)).status).toBe(404);
  });

  it('follows the server clock through the sections and the Listening audio', async () => {
    const test = await createTest('Clock');
    const attempt = (await start(test.id)).body.attempt;
    const [listening, reading] = attempt.sections;
    const at = async (minutes: number) => {
      clock = new Date(START.getTime() + minutes * MINUTE);
      return (await get(attempt.id)).body.attempt;
    };

    const early = await at(10);
    const afterAudio = await at(29);
    const inReading = await at(40);
    const over = await at(91);

    expect(GetAttemptResponseSchema.safeParse({attempt: early}).success).toBe(true);
    expect(listening).toMatchObject({
      skill: 'listening',
      endsAt: new Date(START.getTime() + 30 * MINUTE).toISOString(),
    });
    expect(early).toMatchObject({serverNow: new Date(START.getTime() + 10 * MINUTE).toISOString(), remainingSec: 4800});
    expect(early.currentSectionId).toBe(listening.sectionId);
    expect(early.audio).toEqual({
      sectionId: listening.sectionId,
      streamPath: `/attempts/${attempt.id}/audio`,
      durationSec: 1680,
      positionSec: 600,
      ended: false,
    });
    expect(afterAudio.audio).toMatchObject({positionSec: 1680, ended: true});
    expect(inReading).toMatchObject({currentSectionId: reading.sectionId, audio: null, remainingSec: 3000});
    expect(over).toMatchObject({currentSectionId: null, audio: null, remainingSec: 0});
  });

  it('autosaves the state until the deadline, and refuses it after', async () => {
    const test = await createTest('Save');
    const attempt = (await start(test.id)).body.attempt;
    const questionId = attempt.test.sections[0].passages[0].groups[0].questions[0].id;
    const state = {...EMPTY_ATTEMPT_STATE, answers: {[questionId]: 'library'}, flags: [questionId]};

    clock = new Date(START.getTime() + 5 * MINUTE);
    const saved = await save(attempt.id, state);
    const reloaded = await get(attempt.id);
    const invalid = await save(attempt.id, {...state, answers: {'1': 'library'}});
    clock = new Date(START.getTime() + 90 * MINUTE);
    const late = await save(attempt.id, {...state, answers: {[questionId]: 'late'}});

    expect(saved.status).toBe(200);
    expect(SaveAttemptStateResponseSchema.safeParse(saved.body).success).toBe(true);
    expect(saved.body).toMatchObject({
      savedAt: new Date(START.getTime() + 5 * MINUTE).toISOString(),
      remainingSec: 5100,
    });
    expect(reloaded.body.attempt.state).toEqual(state);
    expect(invalid.status).toBe(400);
    expect(late.status).toBe(409);
    expect(ApiErrorBody.safeParse(late.body).success).toBe(true);
    expect(late.body.error.status).toBe('ATTEMPT_EXPIRED');
    expect((await db.attempt.findUnique({where: {id: attempt.id}}))?.state).toEqual(state);
  });

  it('refuses to save a submitted attempt', async () => {
    const test = await createTest('Submitted');
    const {id} = (await start(test.id)).body.attempt;
    await db.attempt.update({where: {id}, data: {status: 'submitted', submittedAt: START}});

    const response = await save(id, EMPTY_ATTEMPT_STATE);

    expect(response.status).toBe(409);
    expect(response.body.error.status).toBe('ATTEMPT_SUBMITTED');
  });

  it('answers 403 to another user, 404 to a missing attempt, 400 to a bad id and 401 without a token', async () => {
    const test = await createTest('Owner');
    const {id} = (await start(test.id)).body.attempt;

    expect((await get(id, otherId)).status).toBe(403);
    expect((await save(id, EMPTY_ATTEMPT_STATE, otherId)).status).toBe(403);
    expect((await get(MISSING_ID)).status).toBe(404);
    expect((await get('not-a-uuid')).status).toBe(400);
    expect((await request(app).get(`/api/v1/attempts/${id}`)).status).toBe(401);
    expect((await request(app).post('/api/v1/attempts').send({testId: test.id})).status).toBe(401);
  });
});
