import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {EMPTY_ATTEMPT_STATE, GetAttemptResultResponseSchema, ListAttemptsResponseSchema} from '@linmaster/shared';
import {testSecrets} from './exam-fixtures';
import {MINUTE, START, setupAttemptsApi} from './attempts-api';

describe('attempts API: lazy submit, result and history', () => {
  const api = setupAttemptsApi('result');
  const {db, start, get, save, submit, result, list, at, createTest} = api;
  const secrets = testSecrets(api.run);
  const iso = (minutes: number) => new Date(START.getTime() + minutes * MINUTE).toISOString();

  beforeAll(api.setup);
  beforeEach(() => at(0));
  afterAll(api.teardown);

  /** Starts the fixture test and answers Listening question 1 right. */
  async function answered(title: string) {
    const test = await createTest(title);
    const attempt = (await start(test.id)).body.attempt;
    const l1 = attempt.test.sections[0].passages[0].groups[0].questions[0].id;
    await save(attempt.id, {...EMPTY_ATTEMPT_STATE, answers: {[l1]: secrets.answer}});
    return {testId: test.id as string, id: attempt.id as string};
  }

  it('submits an attempt past its deadline when it is read (lazy submit)', async () => {
    const {id} = await answered('Lazy');
    at(93);

    const read = await get(id);
    const graded = await result(id);

    expect(read.body.attempt).toMatchObject({status: 'submitted', autoSubmitted: true, submittedAt: iso(92)});
    expect(graded.status).toBe(200);
    expect(graded.body.result.scores[0]).toMatchObject({skill: 'listening', correct: 1});
    expect(await db.attemptAnswer.count({where: {attemptId: id}})).toBe(3);
  });

  it('submits an expired attempt and starts a new one when the test is started again', async () => {
    const {testId, id} = await answered('Restart');
    at(100);

    const restarted = await start(testId);

    expect(restarted.status).toBe(201);
    expect(restarted.body.attempt.id).not.toBe(id);
    expect((await db.attempt.findUnique({where: {id}}))?.status).toBe('submitted');
  });

  it('shows the result only to its owner, once submitted, with explanations and transcripts', async () => {
    const {id} = await answered('Result');

    const early = await result(id);
    await submit(id);
    const done = await result(id);
    const foreign = await result(id, api.otherId());

    expect(early.status).toBe(409);
    expect(early.body.error.status).toBe('ATTEMPT_NOT_SUBMITTED');
    expect(GetAttemptResultResponseSchema.safeParse(done.body).success).toBe(true);
    expect(done.body.result.questions[0]).toMatchObject({isCorrect: true, explanation: secrets.explanation});
    expect(JSON.stringify(done.body)).toContain(secrets.transcript);
    expect(foreign.status).toBe(403);
    expect((await result(api.MISSING_ID)).status).toBe(404);
  });

  it('lists my attempts newest first, with scores once submitted', async () => {
    const submitted = await answered('History done');
    await submit(submitted.id);
    at(1);
    const running = await answered('History running');

    const response = await list();
    const others = await list(api.otherId());

    expect(response.status).toBe(200);
    expect(ListAttemptsResponseSchema.safeParse(response.body).success).toBe(true);
    const ids = response.body.attempts.map((attempt: {id: string}) => attempt.id);
    expect(ids.indexOf(running.id)).toBeLessThan(ids.indexOf(submitted.id));
    const byId = (id: string) => response.body.attempts.find((attempt: {id: string}) => attempt.id === id);
    expect(byId(running.id)).toMatchObject({status: 'in_progress', scores: []});
    expect(byId(submitted.id)).toMatchObject({
      status: 'submitted',
      testTitle: `History done ${api.run}`,
      testKind: 'full',
      scores: [
        {skill: 'listening', correct: 1, total: 2, band: 1},
        {skill: 'reading', correct: 0, total: 1, band: 0},
      ],
    });
    expect(others.body.attempts).toEqual([]);
  });
});
