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
const emails = [
  `lookup-a-${stamp}@linmaster.test`,
  `lookup-b-${stamp}@linmaster.test`,
  `lookup-c-${stamp}@linmaster.test`,
];

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
  let contextAuth: string;
  let auth: string;

  beforeAll(async () => {
    let contextUserId: string;
    [userId, otherUserId, contextUserId] = await Promise.all(
      emails.map(async email => (await db.user.create({data: {email, passwordHash: 'x', displayName: 'Lookup'}})).id),
    );
    auth = `Bearer ${signJwt(userId, JWT_SECRET)}`;
    // The AI rate limit is 20 a minute per user, so the contextual tests use another user.
    contextAuth = `Bearer ${signJwt(contextUserId, JWT_SECRET)}`;
  });
  beforeEach(async () => {
    await db.vocabLookup.deleteMany({where: {ownerId: userId}});
  });
  afterAll(async () => {
    await db.aiCache.deleteMany({where: {task: 'explain-word.v2', output: {path: ['usageNote'], equals: 'test'}}});
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
      explanation({
        headword: 'mitigated',
        lemma: 'Mitigate',
        partOfSpeech: 'Verb',
        topics: ['Environment'],
        usageNote: 'test',
      }),
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

  describe('contextual lookup (explain-word.v2)', () => {
    const post = (body: object) =>
      request(app).post('/api/v1/vocab/lookups').set('Authorization', contextAuth).send(body);
    const at = (text: string, sentenceText: string, nth = 0) => {
      let from = -1;
      for (let i = 0; i <= nth; i++) from = sentenceText.indexOf(text, from + 1);
      return from;
    };

    it('A: explains one word, and sends the title and paragraph to the AI', async () => {
      const model = createMockAiModel([explanation({headword: 'regression', meaningVi: 'hồi quy', usageNote: 'test'})]);
      setAiModel(model);
      const text = sentence('The regression shows a trend');
      const res = await post({
        text: 'regression',
        sentence: text,
        context: {title: 'Statistics basics', paragraph: 'Para about models. ' + text},
      });

      expect(res.status).toBe(200);
      expect(LookupWordResponseSchema.parse(res.body).match).toEqual({
        text: 'regression',
        start: 4,
        end: 14,
        adjusted: false,
      });
      expect(model.requests[0].text).toContain('Statistics basics');
      expect(model.requests[0].text).toContain('Para about models.');
    });

    it('B: keeps a meaningful phrase whole', async () => {
      const model = createMockAiModel([explanation({headword: 'frequent feedback', usageNote: 'test'})]);
      setAiModel(model);
      const text = sentence('Teachers who give frequent feedback help students');
      const start = at('frequent', text);
      const res = await post({text: 'frequent feedback', sentence: text});

      expect(res.body.match).toEqual({text: 'frequent feedback', start, end: start + 17, adjusted: false});
      expect(res.body.explanation.headword).toBe('frequent feedback');
      expect(model.requests).toHaveLength(1);
    });

    it('C: moves a meaningless selection to the nearest meaningful phrase', async () => {
      setAiModel(createMockAiModel([explanation({headword: 'give frequent feedback', usageNote: 'test'})]));
      const text = sentence('Teachers who give frequent feedback help students');
      const res = await post({text: 'Teachers who give frequent', sentence: text});

      expect(res.body.match).toEqual({text: 'give frequent feedback', start: 13, end: 35, adjusted: true});
      expect(text.slice(res.body.match.start, res.body.match.end)).toBe('give frequent feedback');
    });

    it('accepts one word when the rest of the selection is only function words', async () => {
      const model = createMockAiModel([explanation({headword: 'regression', usageNote: 'test'})]);
      setAiModel(model);
      const text = sentence('We plot the regression line');
      const res = await post({text: 'the regression', sentence: text});

      expect(model.requests).toHaveLength(1);
      expect(res.body.match).toMatchObject({text: 'regression', adjusted: true});
    });

    it('asks again when the AI cuts a meaningful phrase down to one word', async () => {
      const model = createMockAiModel([
        explanation({headword: 'courses', usageNote: 'test'}),
        explanation({headword: 'online courses', usageNote: 'test'}),
      ]);
      setAiModel(model);
      const text = sentence('Many online courses are free');
      const res = await post({text: 'online courses', sentence: text});

      expect(model.requests).toHaveLength(2);
      expect(model.requests[1].text).toContain('cut the selection down to one word');
      expect(res.body.match).toMatchObject({text: 'online courses', adjusted: false});
    });

    it('explains the exact selection when the AI keeps cutting it down', async () => {
      const model = createMockAiModel([
        explanation({headword: 'courses', usageNote: 'test'}),
        explanation({headword: 'Courses', usageNote: 'test'}),
      ]);
      setAiModel(model);
      const text = sentence('Several remote courses are free');
      const start = at('remote', text);
      const res = await post({text: 'remote courses', sentence: text});

      expect(model.requests).toHaveLength(2);
      expect(res.body.match).toEqual({text: 'remote courses', start, end: start + 14, adjusted: false});
      expect(res.body.explanation.headword).toBe('remote courses');
    });

    it('never returns a match outside the sentence when the AI invents a phrase', async () => {
      const model = createMockAiModel([
        explanation({headword: 'regression analysis', usageNote: 'test'}),
        explanation({headword: 'give feedback', usageNote: 'test'}),
      ]);
      setAiModel(model);
      const text = sentence('Researchers fit a regression to the data');
      const start = at('a regression', text);
      const res = await post({text: 'a regression', sentence: text});

      expect(model.requests).toHaveLength(2);
      expect(model.requests[1].text).toContain('not an exact, unbroken part of the sentence');
      expect(res.body.match).toEqual({text: 'a regression', start, end: start + 12, adjusted: false});
      expect(text.slice(res.body.match.start, res.body.match.end)).toBe(res.body.match.text);
    });

    it('rejects an AI phrase that does not touch the selection', async () => {
      setAiModel(
        createMockAiModel([
          explanation({headword: 'students', usageNote: 'test'}),
          explanation({headword: 'students', usageNote: 'test'}),
        ]),
      );
      const text = sentence('Teachers praise students daily');
      const res = await post({text: 'praise', sentence: text});

      expect(res.body.match).toMatchObject({text: 'praise', adjusted: false});
    });

    it('uses textStart to pick the occurrence when the text appears twice', async () => {
      const model = createMockAiModel([explanation({headword: 'bank', usageNote: 'test'})]);
      setAiModel(model);
      const text = sentence('The bank is near the river bank');
      const second = at('bank', text, 1);
      const res = await post({text: 'bank', sentence: text, textStart: second});

      expect(res.body.match).toEqual({text: 'bank', start: second, end: second + 4, adjusted: false});
      expect(model.requests[0].text).toContain('second occurrence');
    });

    it('does not reuse an answer for a different title or paragraph', async () => {
      const model = createMockAiModel([
        explanation({headword: 'regression', meaningVi: 'hồi quy', usageNote: 'test'}),
        explanation({headword: 'regression', meaningVi: 'sự thoái lui', usageNote: 'test'}),
      ]);
      setAiModel(model);
      const text = sentence('The regression was clear');
      const stats = await post({text: 'regression', sentence: text, context: {title: 'Statistics'}});
      const mind = await post({text: 'regression', sentence: text, context: {title: 'Psychology'}});

      expect(model.requests).toHaveLength(2);
      expect(stats.body.explanation.meaningVi).toBe('hồi quy');
      expect(mind.body.explanation.meaningVi).toBe('sự thoái lui');
    });

    it('is still compatible with a client that sends no context', async () => {
      setAiModel(createMockAiModel([explanation({usageNote: 'test'})]));
      const res = await post({text: 'bank', sentence: sentence('The bank was closed')});

      expect(res.status).toBe(200);
      expect(res.body.match).toMatchObject({text: 'bank', adjusted: false});
    });

    it('rejects a textStart that does not point at the text', async () => {
      const model = createMockAiModel([]);
      setAiModel(model);
      const res = await post({text: 'bank', sentence: 'The bank was closed', textStart: 0});

      expect(res.status).toBe(400);
      expect(model.requests).toHaveLength(0);
    });
  });
});
