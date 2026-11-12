import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {CreateAttemptResponseSchema, EMPTY_ATTEMPT_STATE} from '@linmaster/shared';
import {testSecrets} from './exam-fixtures';
import {MINUTE, START, setupAttemptsApi} from './attempts-api';

describe('attempts API: start', () => {
  const api = setupAttemptsApi('read');
  const {db, start, at, createTest} = api;

  beforeAll(api.setup);
  beforeEach(() => at(0));
  afterAll(api.teardown);

  it('starts an attempt with a server deadline, and returns it again while in progress', async () => {
    const test = await createTest('Start');

    const created = await start(test.id);
    at(1);
    const again = await start(test.id);

    expect(created.status).toBe(201);
    expect(CreateAttemptResponseSchema.safeParse(created.body).success).toBe(true);
    expect(created.body.attempt).toMatchObject({
      testId: test.id,
      status: 'in_progress',
      startedAt: START.toISOString(),
      deadlineAt: new Date(START.getTime() + 92 * MINUTE).toISOString(),
      remainingSec: 5520,
      state: EMPTY_ATTEMPT_STATE,
    });
    expect(again.status).toBe(200);
    expect(again.body.attempt).toMatchObject({id: created.body.attempt.id, remainingSec: 5460});
    expect(created.body.attempt.audio).toMatchObject({positionSec: 0, durationSec: 1680, ended: false});
    expect((await db.test.findUnique({where: {id: test.id}}))?.attemptCount).toBe(0);
  });

  it('never sends answers, explanations or Listening transcripts with the attempt', async () => {
    const test = await createTest('Secrets');
    const response = await start(test.id);

    const body = JSON.stringify(response.body);

    for (const secret of [...Object.values(testSecrets(api.run)), '"answer"', '"explanation"']) {
      expect(body).not.toContain(secret);
    }
  });

  it('lets others start a public test once, counted in attemptCount, but not a private one', async () => {
    const shared = await createTest('Public', 'public');
    const privateTest = await createTest('Private');

    const [first, second] = await Promise.all([start(shared.id, api.otherId()), start(shared.id, api.otherId())]);

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.attempt.id).toBe(second.body.attempt.id);
    expect((await db.test.findUnique({where: {id: shared.id}}))?.attemptCount).toBe(1);
    expect((await start(privateTest.id, api.otherId())).status).toBe(404);
    expect((await start(api.MISSING_ID)).status).toBe(404);
  });

  it('answers 400 to a bad test id and 401 without a token', async () => {
    const test = await createTest('Auth');

    expect((await start('not-a-uuid')).status).toBe(400);
    expect((await request(api.app).post('/api/v1/attempts').send({testId: test.id})).status).toBe(401);
  });
});
