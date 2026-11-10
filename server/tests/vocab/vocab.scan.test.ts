import {MAX_SCAN_CANDIDATES, ScanDocumentResponseSchema, type ScanDocumentOutput} from '@linmaster/shared';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {createApp} from '../../src/app';
import {setAiModel} from '../../src/core/ai/ai-gateway';
import {createMockAiModel} from '../../src/core/ai/ai-model';
import {getDb} from '../../src/core/db';
import {signJwt} from '../../src/core/jwt';
import {verifyCandidates} from '../../src/modules/vocab/scan.service';

type Candidate = ScanDocumentOutput['candidates'][number];

function candidate(overrides: Partial<Candidate>): Candidate {
  return {
    headword: 'mitigate',
    lemma: 'mitigate',
    partOfSpeech: 'verb',
    meaningVi: 'giảm nhẹ',
    cefr: 'C1',
    topics: ['environment'],
    sentence: 'Cities plant trees to mitigate the heat.',
    ...overrides,
  };
}

const TEXT = 'Cities plant trees to mitigate the heat.\n\nPolicy makers face a daunting task.';

describe('verifyCandidates', () => {
  it('drops a candidate whose sentence was invented by the AI', () => {
    const result = verifyCandidates(TEXT, [
      candidate({}),
      candidate({headword: 'curb', lemma: 'curb', sentence: 'Governments must curb emissions.'}),
      candidate({headword: 'trees', lemma: 'tree', sentence: 'Cities plant many trees.'}), // rewritten sentence
    ]);
    expect(result.map(c => c.lemma)).toEqual(['mitigate']);
  });

  it('drops a candidate whose headword is not in its sentence', () => {
    expect(verifyCandidates(TEXT, [candidate({headword: 'alleviate'})])).toEqual([]);
    // Matches whole words only: "heat" is not found inside "heated".
    expect(
      verifyCandidates('The debate heated up.', [candidate({headword: 'heat', sentence: 'The debate heated up.'})]),
    ).toEqual([]);
  });

  it('adds headword offsets in the document text across paragraphs', () => {
    const [found] = verifyCandidates(TEXT, [
      candidate({
        headword: 'Daunting',
        lemma: 'Daunting',
        partOfSpeech: 'Adjective',
        topics: ['Work'],
        sentence: 'Policy makers face a daunting task.',
      }),
    ]);
    expect(TEXT.slice(found.startOffset, found.endOffset)).toBe('daunting');
    expect(found).toMatchObject({headword: 'daunting', lemma: 'daunting', partOfSpeech: 'adjective', topics: ['work']});
  });

  it('drops levels outside the filter and repeated lemmas', () => {
    const result = verifyCandidates(
      TEXT,
      [
        candidate({}),
        candidate({}),
        candidate({
          headword: 'daunting',
          lemma: 'daunting',
          cefr: 'B1',
          sentence: 'Policy makers face a daunting task.',
        }),
      ],
      ['C1'],
    );
    expect(result).toHaveLength(1);
  });

  it(`keeps at most ${MAX_SCAN_CANDIDATES} candidates`, () => {
    const words = Array.from({length: MAX_SCAN_CANDIDATES + 5}, (_, i) => `word${i}`);
    const text = words.join(' ');
    const many = words.map(word => candidate({headword: word, lemma: word, sentence: text}));
    expect(verifyCandidates(text, many)).toHaveLength(MAX_SCAN_CANDIDATES);
  });
});

// Route tests: real test database and routes; only the model is the mock, Gemini is never called.
const JWT_SECRET = 'scan-test-secret-that-is-at-least-32-characters';
const app = createApp({NODE_ENV: 'test', JWT_SECRET, CORS_ORIGINS: ['http://localhost:3000']});
const stamp = Date.now();
const emails = [`scan-a-${stamp}@linmaster.test`, `scan-b-${stamp}@linmaster.test`];

describe('POST /api/v1/vocab/documents/:id/scan', () => {
  const db = getDb();
  let auth: string;
  let documentId: string;
  let otherDocumentId: string;

  beforeAll(async () => {
    const [userId, otherUserId] = await Promise.all(
      emails.map(async email => (await db.user.create({data: {email, passwordHash: 'x', displayName: 'Scan'}})).id),
    );
    auth = `Bearer ${signJwt(userId, JWT_SECRET)}`;
    // The stamp makes the text unique, so AiCache rows from earlier runs never answer this one.
    const paragraphs = [
      {text: 'Cities plant trees to mitigate the heat.'},
      {text: `Policy makers face a daunting task ${stamp}.`},
    ];
    [documentId, otherDocumentId] = await Promise.all(
      [userId, otherUserId].map(
        async ownerId =>
          (await db.document.create({data: {ownerId, title: 'Doc', source: 'paste', paragraphs, wordCount: 14}})).id,
      ),
    );
  });
  afterAll(async () => {
    await db.aiCache.deleteMany({
      where: {task: 'scan-document.v1', output: {path: ['candidates', '0', 'meaningVi'], equals: 'giảm nhẹ'}},
    });
    await db.user.deleteMany({where: {email: {in: emails}}});
    await db.$disconnect();
  });

  it('returns verified candidates with offsets and drops invented sentences', async () => {
    const model = createMockAiModel([
      {
        candidates: [
          candidate({}),
          candidate({headword: 'curb', lemma: 'curb', sentence: 'Governments must curb emissions.'}),
        ],
      },
    ]);
    setAiModel(model);

    const res = await request(app)
      .post(`/api/v1/vocab/documents/${documentId}/scan`)
      .set('Authorization', auth)
      .send({levels: ['C1'], topics: ['Environment']});

    expect(res.status).toBe(200);
    const {candidates} = ScanDocumentResponseSchema.parse(res.body);
    expect(candidates.map(c => c.lemma)).toEqual(['mitigate']);
    expect(candidates[0]).toMatchObject({startOffset: 22, endOffset: 30});
    // The document and the typed topics reach the model inside the user-data fence.
    expect(model.requests[0].text).toContain('Cities plant trees to mitigate the heat.\n\nPolicy makers');
    expect(model.requests[0].text).toContain('<<<USER_DATA>>>\nenvironment');
  });

  it('answers 404 for a document of another user without calling the AI', async () => {
    const model = createMockAiModel([]);
    setAiModel(model);
    const res = await request(app)
      .post(`/api/v1/vocab/documents/${otherDocumentId}/scan`)
      .set('Authorization', auth)
      .send({});
    expect(res.status).toBe(404);
    expect(model.requests).toHaveLength(0);
  });

  it('validates the id and the filters', async () => {
    const post = (id: string, body: object) =>
      request(app).post(`/api/v1/vocab/documents/${id}/scan`).set('Authorization', auth).send(body);
    expect((await post('not-a-uuid', {})).status).toBe(400);
    expect((await post(documentId, {levels: ['D1']})).status).toBe(400);
    expect((await post(documentId, {levels: []})).status).toBe(400);
    expect((await post(documentId, {extra: true})).status).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await request(app).post(`/api/v1/vocab/documents/${documentId}/scan`).send({})).status).toBe(401);
  });
});
