import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {EMPTY_ATTEMPT_STATE, SubmitAttemptResponseSchema} from '@linmaster/shared';
import {testSecrets} from './exam-fixtures';
import {MINUTE, START, setupAttemptsApi} from './attempts-api';

describe('attempts API: submit', () => {
  const api = setupAttemptsApi('submit');
  const {db, start, get, save, submit, at, createTest} = api;
  const secrets = testSecrets(api.run);
  const iso = (minutes: number) => new Date(START.getTime() + minutes * MINUTE).toISOString();

  beforeAll(api.setup);
  beforeEach(() => at(0));
  afterAll(api.teardown);

  /** Starts the fixture test and answers: Listening 1 right, Listening 2 wrong, Reading 1 right. */
  async function answered(title: string) {
    const test = await createTest(title);
    const attempt = (await start(test.id)).body.attempt;
    const [listening, reading] = attempt.test.sections;
    const [l1, l2] = listening.passages[0].groups[0].questions;
    const [r1] = reading.passages[0].groups[0].questions;
    await save(attempt.id, {
      ...EMPTY_ATTEMPT_STATE,
      answers: {[l1.id]: secrets.answer, [l2.id]: 'wrong', [r1.id]: 'a'},
    });
    return {test, id: attempt.id as string, l1: l1.id as string};
  }

  it('grades the attempt, with bands, explanations and Listening transcripts', async () => {
    const {id, l1} = await answered('Grade');
    at(10);

    const response = await submit(id);

    expect(response.status).toBe(200);
    expect(SubmitAttemptResponseSchema.safeParse(response.body).success).toBe(true);
    const {result} = response.body;
    expect(result).toMatchObject({status: 'submitted', submittedAt: iso(10), autoSubmitted: false});
    expect(result.scores).toEqual([
      {skill: 'listening', correct: 1, total: 2, band: 1},
      {skill: 'reading', correct: 1, total: 1, band: 1},
    ]);
    expect(
      result.questions.map((q: {skill: string; number: number; isCorrect: boolean}) => [
        q.skill,
        q.number,
        q.isCorrect,
      ]),
    ).toEqual([
      ['listening', 1, true],
      ['listening', 2, false],
      ['reading', 1, true],
    ]);
    expect(result.questions[0]).toMatchObject({
      questionId: l1,
      given: secrets.answer,
      correct: [secrets.answer],
      explanation: secrets.explanation,
    });
    expect(result.transcripts).toMatchObject([
      {title: 'Part 1', paragraphs: [{label: 'Woman', text: secrets.transcript}]},
    ]);
    expect((await get(id)).body.attempt).toMatchObject({status: 'submitted', remainingSec: 0, audio: null});
  });

  it('keeps the first result when submitted twice or at the same time, and snapshots the answer key', async () => {
    const {id, l1} = await answered('Twice');

    const [first, second] = await Promise.all([submit(id), submit(id)]);
    await db.question.update({where: {id: l1}, data: {answer: {accepted: ['changed']}}});
    at(5);
    const third = await submit(id);

    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(third.body).toEqual(first.body);
    expect(await db.attemptAnswer.count({where: {attemptId: id}})).toBe(3);
  });

  it('marks an attempt submitted after the deadline as autoSubmitted at the deadline', async () => {
    const {id} = await answered('Late');
    at(100);

    const {result} = (await submit(id)).body;

    expect(result).toMatchObject({autoSubmitted: true, submittedAt: iso(92)});
  });

  it('refuses autosave after submitting, and answers 403 to another user', async () => {
    const {id} = await answered('Closed');
    expect((await submit(id, api.otherId())).status).toBe(403);
    await submit(id);

    const late = await save(id, EMPTY_ATTEMPT_STATE);

    expect(late.status).toBe(409);
    expect(late.body.error.status).toBe('ATTEMPT_SUBMITTED');
    expect((await submit(api.MISSING_ID)).status).toBe(404);
  });
});
