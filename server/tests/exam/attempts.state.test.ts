import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {
  ApiErrorBody,
  EMPTY_ATTEMPT_STATE,
  GetAttemptResponseSchema,
  SaveAttemptStateResponseSchema,
} from '@linmaster/shared';
import {testSecrets} from './exam-fixtures';
import {MINUTE, START, setupAttemptsApi} from './attempts-api';

describe('attempts API: read and autosave', () => {
  const api = setupAttemptsApi('state');
  const {db, start, get, save, at, createTest} = api;
  const iso = (minutes: number) => new Date(START.getTime() + minutes * MINUTE).toISOString();

  beforeAll(api.setup);
  beforeEach(() => at(0));
  afterAll(api.teardown);

  it('follows the server clock through the sections and the Listening audio', async () => {
    const test = await createTest('Clock');
    const attempt = (await start(test.id)).body.attempt;
    const [listening, reading] = attempt.sections;
    const read = async (minutes: number) => {
      at(minutes);
      return (await get(attempt.id)).body.attempt;
    };

    const early = await read(10);
    const afterAudio = await read(29);
    const inReading = await read(40);
    const over = await read(92);

    expect(GetAttemptResponseSchema.safeParse({attempt: early}).success).toBe(true);
    expect(early).toMatchObject({serverNow: iso(10), remainingSec: 4920, currentSectionId: listening.sectionId});
    expect(early.audio).toEqual({
      sectionId: listening.sectionId,
      streamPath: `/attempts/${attempt.id}/audio`,
      durationSec: 1680,
      positionSec: 600,
      ended: false,
    });
    expect(afterAudio.audio).toMatchObject({positionSec: 1680, ended: true});
    expect(inReading).toMatchObject({currentSectionId: reading.sectionId, audio: null, remainingSec: 3120});
    expect(over).toMatchObject({currentSectionId: null, audio: null, remainingSec: 0});
  });

  it('never sends answers, explanations or Listening transcripts when reading an attempt', async () => {
    const test = await createTest('Secrets');
    const {id} = (await start(test.id)).body.attempt;

    const body = JSON.stringify((await get(id)).body);

    for (const secret of [...Object.values(testSecrets(api.run)), '"answer"', '"explanation"']) {
      expect(body).not.toContain(secret);
    }
  });

  it('autosaves the state until the deadline, and refuses it after', async () => {
    const test = await createTest('Save');
    const attempt = (await start(test.id)).body.attempt;
    const questionId = attempt.test.sections[0].passages[0].groups[0].questions[0].id;
    const state = {...EMPTY_ATTEMPT_STATE, answers: {[questionId]: 'library'}, flags: [questionId]};

    at(5);
    const saved = await save(attempt.id, state);
    const reloaded = await get(attempt.id);
    const invalid = await save(attempt.id, {...state, answers: {'1': 'library'}});
    at(92);
    const late = await save(attempt.id, {...state, answers: {[questionId]: 'late'}});

    expect(saved.status).toBe(200);
    expect(SaveAttemptStateResponseSchema.safeParse(saved.body).success).toBe(true);
    expect(saved.body).toMatchObject({savedAt: iso(5), remainingSec: 5220});
    expect(reloaded.body.attempt.state).toEqual(state);
    expect(invalid.status).toBe(400);
    expect(late.status).toBe(409);
    expect(ApiErrorBody.safeParse(late.body).success).toBe(true);
    expect(late.body.error.status).toBe('ATTEMPT_EXPIRED');
    expect((await db.attempt.findUnique({where: {id: attempt.id}}))?.state).toEqual(state);
  });

  it('drops answers, flags, highlights, notes and a position that are not of the test', async () => {
    const test = await createTest('Foreign keys');
    const attempt = (await start(test.id)).body.attempt;
    const section = attempt.test.sections[0];
    const passage = section.passages[0];
    const questionId = passage.groups[0].questions[0].id;
    const foreign = api.MISSING_ID;
    const range = (passageId: string) => ({passageId, paragraph: 0, start: 0, end: 4});

    at(5);
    const saved = await save(attempt.id, {
      answers: {[questionId]: 'library', [foreign]: 'smuggled'},
      highlights: [range(passage.id), range(foreign)],
      notes: [
        {...range(passage.id), text: 'mine'},
        {...range(foreign), text: 'theirs'},
      ],
      flags: [questionId, foreign],
      position: {sectionId: section.sectionId ?? section.id, questionId: foreign},
    });

    expect(saved.status).toBe(200);
    const kept = (await db.attempt.findUnique({where: {id: attempt.id}}))?.state;
    expect(JSON.stringify(kept)).not.toContain('smuggled');
    expect(JSON.stringify(kept)).not.toContain(foreign);
    expect(kept).toMatchObject({
      answers: {[questionId]: 'library'},
      highlights: [range(passage.id)],
      notes: [{...range(passage.id), text: 'mine'}],
      flags: [questionId],
      position: {questionId: null},
    });
    const lost = await save(attempt.id, {...EMPTY_ATTEMPT_STATE, position: {sectionId: foreign, questionId}});
    expect(lost.status).toBe(200);
    expect(
      ((await db.attempt.findUnique({where: {id: attempt.id}}))?.state as {position: unknown}).position,
    ).toBeNull();
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

    expect((await get(id, api.otherId())).status).toBe(403);
    expect((await save(id, EMPTY_ATTEMPT_STATE, api.otherId())).status).toBe(403);
    expect((await get(api.MISSING_ID)).status).toBe(404);
    expect((await get('not-a-uuid')).status).toBe(400);
    expect((await request(api.app).get(`/api/v1/attempts/${id}`)).status).toBe(401);
    expect((await request(api.app).put(`/api/v1/attempts/${id}/state`).send({state: {}})).status).toBe(401);
  });
});
