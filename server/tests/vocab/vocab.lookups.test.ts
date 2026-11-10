import {LookupWordResponseSchema, type WordExplanation} from '@linmaster/shared';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {createApp} from '../../src/app';
import {setAiModel} from '../../src/core/ai/ai-gateway';
import {createMockAiModel} from '../../src/core/ai/ai-model';
import {getDb} from '../../src/core/db';
import {signJwt} from '../../src/core/jwt';

// Real test database and routes; only the model is the mock, Gemini is never called.
const JWT_SECRET = 'lookups-test-secret-that-is-at-least-32-characters';
const app = createApp({NODE_ENV: 'test', JWT_SECRET, CORS_ORIGINS: ['http://localhost:3000']});
const stamp = Date.now();
const emails = [`lookup-a-${stamp}@linmaster.test`, `lookup-b-${stamp}@linmaster.test`];

function explanation(overrides: Partial<WordExplanation>): WordExplanation {
  return {
    headword: 'bank',
    lemma: 'bank',
    partOfSpeech: 'noun',
    ipa: '/bæŋk/',
    meaningVi: 'ngân hàng',
    definitionEn: null,
    usageNote: null,
    collocations: [],
    cefr: 'A2',
    topics: [],
    ...overrides,
  };
}

// Each test uses its own sentences, so earlier tests never serve it from AiCache.
const sentence = (text: string) => `${text} ${stamp}.`;

describe('POST /api/v1/vocab/lookups', () => {
  const db = getDb();
  let userId: string;
  let otherUserId: string;
  let auth: string;

  beforeAll(async () => {
    [userId, otherUserId] = await Promise.all(
      emails.map(async email => (await db.user.create({data: {email, passwordHash: 'x', displayName: 'Lookup'}})).id),
    );
    auth = `Bearer ${signJwt(userId, JWT_SECRET)}`;
  });
  beforeEach(async () => {
    await db.vocabLookup.deleteMany({where: {ownerId: userId}});
  });
  afterAll(async () => {
    await db.aiCache.deleteMany({where: {task: 'explain-word.v1', output: {path: ['usageNote'], equals: 'test'}}});
    await db.user.deleteMany({where: {email: {in: emails}}});
    await db.$disconnect();
  });

  it('gives the same word a different meaning in a different sentence', async () => {
    const model = createMockAiModel([
      explanation({meaningVi: 'bờ sông', usageNote: 'test'}),
      explanation({meaningVi: 'ngân hàng', usageNote: 'test'}),
    ]);
    setAiModel(model);
    const river = sentence('We sat on the river bank');
    const money = sentence('She opened an account at the bank');

    const first = await request(app).post('/api/v1/vocab/lookups').set('Authorization', auth).send({
      text: 'bank',
      sentence: river,
    });
    const second = await request(app).post('/api/v1/vocab/lookups').set('Authorization', auth).send({
      text: 'bank',
      sentence: money,
    });

    expect(first.status).toBe(200);
    expect(LookupWordResponseSchema.parse(first.body).explanation.meaningVi).toBe('bờ sông');
    expect(second.body.explanation.meaningVi).toBe('ngân hàng');
    // Each sentence reached the model inside the user-data fence.
    expect(model.requests[0].text).toContain(river);
    expect(model.requests[1].text).toContain(money);
    expect(model.requests[0].text).toContain('<<<USER_DATA>>>');
    expect(await db.vocabLookup.count({where: {ownerId: userId, saved: false}})).toBe(2);
  });

  it('serves a repeated lookup from the cache and points to the saved entry', async () => {
    const model = createMockAiModel([
      explanation({lemma: 'Mitigate', partOfSpeech: 'Verb', topics: ['Environment'], usageNote: 'test'}),
    ]);
    setAiModel(model);
    const entry = await db.vocabEntry.create({
      data: {ownerId: userId, headword: 'mitigate', lemma: 'mitigate', partOfSpeech: 'verb', meaningVi: 'giảm nhẹ'},
    });
    const body = {text: 'mitigated', sentence: sentence('Trees mitigated the heat')};

    const first = await request(app).post('/api/v1/vocab/lookups').set('Authorization', auth).send(body);
    const second = await request(app).post('/api/v1/vocab/lookups').set('Authorization', auth).send(body);

    expect(model.requests).toHaveLength(1);
    expect(first.body).toEqual(second.body);
    // Normalised like SaveVocabEntrySchema, so it matches the saved entry.
    expect(first.body.explanation).toMatchObject({lemma: 'mitigate', partOfSpeech: 'verb', topics: ['environment']});
    expect(first.body.savedEntryId).toBe(entry.id);
  });

  it('records the document of a lookup and hides other users documents', async () => {
    setAiModel(createMockAiModel([explanation({usageNote: 'test'})]));
    const [mine, theirs] = await Promise.all(
      [userId, otherUserId].map(ownerId =>
        db.document.create({
          data: {ownerId, title: 'Doc', source: 'paste', paragraphs: [{text: 'x'}], wordCount: 1},
        }),
      ),
    );

    const ok = await request(app)
      .post('/api/v1/vocab/lookups')
      .set('Authorization', auth)
      .send({text: 'bank', sentence: sentence('The bank was closed'), documentId: mine.id});
    const forbidden = await request(app)
      .post('/api/v1/vocab/lookups')
      .set('Authorization', auth)
      .send({text: 'bank', sentence: sentence('The bank was open'), documentId: theirs.id});

    expect(ok.status).toBe(200);
    expect(await db.vocabLookup.findFirst({where: {ownerId: userId}})).toMatchObject({documentId: mine.id});
    expect(forbidden.status).toBe(404);
  });

  it('validates the request before calling the AI', async () => {
    const model = createMockAiModel([]);
    setAiModel(model);
    const post = (body: object) => request(app).post('/api/v1/vocab/lookups').set('Authorization', auth).send(body);

    expect(
      (await post({text: 'one two three four five six seven', sentence: 'one two three four five six seven'})).status,
    ).toBe(400);
    expect((await post({text: 'bank', sentence: 'No match here.'})).status).toBe(400);
    expect((await post({text: 'bank', sentence: 'The bank.', extra: true})).status).toBe(400);
    expect(model.requests).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/vocab/lookups').send({text: 'bank', sentence: 'The bank.'});
    expect(res.status).toBe(401);
  });

  it('passes AI errors through in the standard format', async () => {
    setAiModel(createMockAiModel(['{', '{', '{']));
    const res = await request(app)
      .post('/api/v1/vocab/lookups')
      .set('Authorization', auth)
      .send({text: 'bank', sentence: sentence('A broken bank')});

    expect(res.status).toBe(502);
    expect(res.body.error).toMatchObject({code: 502, status: 'AI_INVALID_OUTPUT'});
    expect(await db.vocabLookup.count({where: {ownerId: userId}})).toBe(0);
  });
});
