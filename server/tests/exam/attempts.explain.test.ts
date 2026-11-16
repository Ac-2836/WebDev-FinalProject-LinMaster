import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {ExplainQuestionResponseSchema} from '@linmaster/shared';
import {createMockAiModel} from '../../src/core/ai/ai-model';
import {setAiModel} from '../../src/core/ai/ai-gateway';
import {generateOpenApiDocument} from '../../src/core/openapi-registry';
import {testSecrets} from './exam-fixtures';
import {setupAttemptsApi} from './attempts-api';

describe('attempts API: explain an answer', () => {
  const api = setupAttemptsApi('explain');
  const {db, app, start, submit, at, createTest} = api;
  const secrets = testSecrets(api.run);

  beforeAll(api.setup);
  beforeEach(async () => {
    at(0);
    // The same fixture question gives the same prompt in every test: forget earlier answers of the model.
    await db.aiCache.deleteMany({where: {task: 'explain-answer.v1'}});
  });
  afterAll(api.teardown);

  const explain = (id: string, no: number | string, skill?: string, userId?: string) =>
    request(app)
      .post(`/api/v1/attempts/${id}/questions/${no}/explain${skill ? `?skill=${skill}` : ''}`)
      .set('Authorization', api.auth(userId));

  /** A Full test whose Listening question 2 has no explanation in its file; the attempt may be left open. */
  async function attemptOn(title: string, {submitted = true} = {}) {
    const test = await createTest(title);
    await db.question.updateMany({
      where: {prompt: 'Bring a {{blank}}', group: {passage: {section: {testId: test.id}}}},
      data: {answer: {accepted: [secrets.answer]}},
    });
    const id = (await start(test.id)).body.attempt.id as string;
    if (submitted) await submit(id);
    return id;
  }

  const aiReply = (...quotes: string[]) => ({
    explanation: 'Người nói hẹn gặp ở một nơi được nhắc trong bài nghe.',
    evidence: quotes.map(quote => ({paragraph: 0, quote})),
  });

  it('returns the explanation of the file without calling the AI', async () => {
    const model = createMockAiModel([]);
    setAiModel(model);
    const id = await attemptOn('File explanation');

    const listening = await explain(id, 1, 'listening');
    const reading = await explain(id, 1, 'reading');

    expect(ExplainQuestionResponseSchema.safeParse(listening.body).success).toBe(true);
    expect(listening.body.explanation).toEqual({
      number: 1,
      skill: 'listening',
      source: 'file',
      text: secrets.explanation,
      evidence: [],
    });
    expect(reading.body.explanation).toMatchObject({skill: 'reading', source: 'file'});
    expect(model.requests).toHaveLength(0);
  });

  it('explains a question without a file explanation, with only the quotes found in the transcript', async () => {
    const model = createMockAiModel([aiReply(secrets.transcript.toUpperCase(), 'a sentence the model invented')]);
    setAiModel(model);
    const id = await attemptOn('AI explanation');

    const first = await explain(id, 2);
    const again = await explain(id, 2);

    expect(first.status).toBe(200);
    expect(ExplainQuestionResponseSchema.safeParse(first.body).success).toBe(true);
    expect(first.body.explanation).toMatchObject({number: 2, skill: 'listening', source: 'ai'});
    expect(first.body.explanation.evidence).toEqual([
      {
        passageId: expect.any(String),
        paragraph: 0,
        start: 0,
        end: secrets.transcript.length,
        quote: secrets.transcript,
      },
    ]);
    // Same question and answer again: served from the cache, no second model call.
    expect(again.body).toEqual(first.body);
    expect(model.requests).toHaveLength(1);
    expect(model.requests[0]!.text).toContain(secrets.transcript);
  });

  it('asks again when the quotes are not in the text, and returns the explanation without evidence at the end', async () => {
    const model = createMockAiModel(Array.from({length: 3}, () => aiReply('nothing like the transcript')));
    setAiModel(model);
    const id = await attemptOn('Invented quotes');

    const response = await explain(id, 2);

    expect(response.status).toBe(200);
    expect(response.body.explanation).toMatchObject({source: 'ai', evidence: []});
    expect(model.requests).toHaveLength(3);
  });

  it('answers 502 when the model never returns a valid result, and 503 when it is unreachable', async () => {
    setAiModel(createMockAiModel(['not json', 'not json', 'not json']));
    const id = await attemptOn('Invalid output');
    const invalid = await explain(id, 2);

    setAiModel(createMockAiModel([Object.assign(new Error('bad request'), {status: 400})]));
    const unreachable = await explain(id, 2);

    expect(invalid.status).toBe(502);
    expect(invalid.body.error.status).toBe('AI_INVALID_OUTPUT');
    expect(unreachable.status).toBe(503);
  });

  it('refuses an attempt that is not submitted, not yours or not found, without calling the AI', async () => {
    const model = createMockAiModel([]);
    setAiModel(model);
    const open = await attemptOn('Still open', {submitted: false});
    const done = await attemptOn('Submitted');

    const early = await explain(open, 2);
    const foreign = await explain(done, 2, undefined, api.otherId());
    const missing = await explain(api.MISSING_ID, 2);
    const anonymous = await request(app).post(`/api/v1/attempts/${done}/questions/2/explain`);

    expect(early.status).toBe(409);
    expect(early.body.error.status).toBe('ATTEMPT_NOT_SUBMITTED');
    expect(foreign.status).toBe(403);
    expect(missing.status).toBe(404);
    expect(anonymous.status).toBe(401);
    expect(model.requests).toHaveLength(0);
  });

  it('checks the question number and the skill', async () => {
    const model = createMockAiModel([]);
    setAiModel(model);
    const id = await attemptOn('Numbers');

    const both = await explain(id, 1);
    const none = await explain(id, 99);
    const wrongSkill = await explain(id, 2, 'reading');
    const zero = await explain(id, 0);
    const text = await explain(id, 'abc');
    const badSkill = await explain(id, 1, 'speaking');
    const badId = await explain('not-a-uuid', 1);

    expect(both.status).toBe(400);
    expect(none.status).toBe(404);
    expect(wrongSkill.status).toBe(404);
    expect([zero.status, text.status, badSkill.status, badId.status]).toEqual([400, 400, 400, 400]);
    expect(model.requests).toHaveLength(0);
  });

  it('refuses a question whose part has no transcript to explain from', async () => {
    const model = createMockAiModel([]);
    setAiModel(model);
    const id = await attemptOn('No transcript');
    await db.passage.updateMany({
      where: {title: 'Part 1', section: {test: {attempts: {some: {id}}}}},
      data: {paragraphs: []},
    });

    const response = await explain(id, 2);

    expect(response.status).toBe(422);
    expect(response.body.error.status).toBe('EXPLAIN_NO_TEXT');
    expect(model.requests).toHaveLength(0);
  });

  it('documents the route', () => {
    const operation = generateOpenApiDocument().paths?.['/api/v1/attempts/{id}/questions/{no}/explain']?.post;

    expect(operation).toMatchObject({security: [{bearerAuth: []}]});
    expect(Object.keys(operation?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '400', '401', '403', '404', '409', '422', '429', '502', '503']),
    );
  });
});
