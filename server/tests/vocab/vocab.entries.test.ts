import express from 'express';
import request from 'supertest';
import {beforeEach, describe, expect, it} from 'vitest';
import type {ListVocabEntriesQuery, SaveVocabEntry, VocabEntry} from '@linmaster/shared';
import {errorMiddleware} from '../../src/core/error.middleware';
import {generateOpenApiDocument} from '../../src/core/openapi-registry';
import {signJwt} from '../../src/core/jwt';
import type {VocabRepository} from '../../src/modules/vocab/vocab.repository';
import {createVocabModule} from '../../src/modules/vocab';

const JWT_SECRET = 'vocab-test-secret-that-is-at-least-32-characters';
const USER_ID = '0192f7e0-0bcd-7000-8000-000000000001';
const OTHER_USER_ID = '0192f7e0-0bcd-7000-8000-000000000002';
const ENTRY_ID = '0192f7e0-0bcd-7000-8000-000000000003';
const OTHER_ENTRY_ID = '0192f7e0-0bcd-7000-8000-000000000004';

function makeEntry(overrides: Partial<VocabEntry> = {}): VocabEntry {
  return {
    id: ENTRY_ID,
    headword: 'mitigated',
    lemma: 'mitigate',
    partOfSpeech: 'verb',
    ipa: null,
    meaningVi: 'giảm nhẹ',
    definitionEn: null,
    usageNote: null,
    collocations: [],
    cefr: 'B2',
    topics: ['environment'],
    note: null,
    contexts: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepository(): VocabRepository & {entries: Map<string, {ownerId: string; entry: VocabEntry}>} {
  const entries = new Map<string, {ownerId: string; entry: VocabEntry}>();
  entries.set(OTHER_ENTRY_ID, {ownerId: OTHER_USER_ID, entry: makeEntry({id: OTHER_ENTRY_ID, lemma: 'private'})});

  return {
    entries,
    async saveEntry(ownerId, input: SaveVocabEntry) {
      const existing = [...entries.values()].find(
        value =>
          value.ownerId === ownerId &&
          value.entry.lemma === input.lemma &&
          value.entry.partOfSpeech === input.partOfSpeech,
      );
      const id = existing?.entry.id ?? (entries.size === 1 ? ENTRY_ID : '0192f7e0-0bcd-7000-8000-000000000006');
      const context = input.context
        ? {
            id: `0192f7e0-0bcd-7000-8000-00000000000${5 + (existing?.entry.contexts.length ?? 0)}`,
            documentId: input.context.documentId ?? null,
            sentence: input.context.sentence,
            startOffset: input.context.startOffset ?? null,
            endOffset: input.context.endOffset ?? null,
            sourceUrl: input.context.sourceUrl ?? null,
            createdAt: '2026-01-01T00:00:00.000Z',
          }
        : null;
      const entry = makeEntry({
        ...(existing?.entry ?? {}),
        headword: input.headword,
        lemma: input.lemma,
        partOfSpeech: input.partOfSpeech,
        meaningVi: input.meaningVi,
        id,
        ipa: input.ipa ?? null,
        definitionEn: input.definitionEn ?? null,
        usageNote: input.usageNote ?? null,
        collocations: input.collocations ?? [],
        cefr: input.cefr ?? null,
        topics: input.topics ?? [],
        note: existing?.entry.note ?? null,
        contexts:
          context && !existing?.entry.contexts.some(item => item.sentence === context.sentence)
            ? [...(existing?.entry.contexts ?? []), context]
            : (existing?.entry.contexts ?? []),
      });
      entries.set(id, {ownerId, entry});
      return entry;
    },
    async listEntries(ownerId, query: ListVocabEntriesQuery) {
      const matches = [...entries.values()]
        .filter(({ownerId: entryOwner, entry}) => {
          if (entryOwner !== ownerId) return false;
          if (
            query.q &&
            !`${entry.headword} ${entry.lemma} ${entry.meaningVi}`.toLowerCase().includes(query.q.toLowerCase())
          )
            return false;
          if (query.topic && !entry.topics.includes(query.topic)) return false;
          if (query.cefr && entry.cefr !== query.cefr) return false;
          if (query.documentId && !entry.contexts.some(context => context.documentId === query.documentId))
            return false;
          return true;
        })
        .map(({entry}) => entry);
      const start = (query.page - 1) * query.pageSize;
      return {entries: matches.slice(start, start + query.pageSize), total: matches.length};
    },
    async findEntry(ownerId, id) {
      const value = entries.get(id);
      return value?.ownerId === ownerId ? value.entry : null;
    },
    async updateNote(ownerId, id, note) {
      const value = entries.get(id);
      if (value?.ownerId !== ownerId) return null;
      const entry = {...value.entry, note};
      entries.set(id, {ownerId, entry});
      return entry;
    },
    async deleteEntry(ownerId, id) {
      const value = entries.get(id);
      if (value?.ownerId !== ownerId) return false;
      entries.delete(id);
      return true;
    },
    async getEntriesForUser(ownerId, ids) {
      return ids.flatMap(id => {
        const value = entries.get(id);
        return value?.ownerId === ownerId ? [value.entry] : [];
      });
    },
  };
}

function createTestServer(repository: VocabRepository) {
  const app = express();
  app.use(express.json());
  app.use(createVocabModule(JWT_SECRET, repository).router);
  app.use(errorMiddleware);
  return app;
}

function authHeader(userId = USER_ID) {
  return `Bearer ${signJwt(userId, JWT_SECRET)}`;
}

describe('vocab entries API', () => {
  let repository: ReturnType<typeof makeRepository>;
  let app: express.Express;

  beforeEach(() => {
    repository = makeRepository();
    app = createTestServer(repository);
  });

  it('requires authentication, saves entries, and merges duplicate lemma and part of speech contexts', async () => {
    const unauthenticated = await request(app).get('/vocab/entries');
    expect(unauthenticated.status).toBe(401);

    const response = await request(app)
      .post('/vocab/entries')
      .set('Authorization', authHeader())
      .send({
        entries: [
          {
            headword: 'mitigated',
            lemma: 'mitigate',
            partOfSpeech: 'verb',
            meaningVi: 'giảm nhẹ',
            context: {sentence: 'Policy mitigated harm.'},
          },
          {
            headword: 'mitigates',
            lemma: 'mitigate',
            partOfSpeech: 'verb',
            meaningVi: 'giảm nhẹ',
            context: {sentence: 'It mitigates risk.'},
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.entries).toHaveLength(1);
    expect(response.body.entries[0].contexts.map((context: {sentence: string}) => context.sentence)).toEqual([
      'Policy mitigated harm.',
      'It mitigates risk.',
    ]);
  });

  it('searches, filters, and paginates only the authenticated user entries', async () => {
    await request(app)
      .post('/vocab/entries')
      .set('Authorization', authHeader())
      .send({
        entries: [
          {
            headword: 'mitigate',
            lemma: 'mitigate',
            partOfSpeech: 'verb',
            meaningVi: 'giảm nhẹ',
            topics: ['environment'],
            cefr: 'B2',
          },
          {
            headword: 'resilient',
            lemma: 'resilient',
            partOfSpeech: 'adjective',
            meaningVi: 'kiên cường',
            topics: ['health'],
            cefr: 'C1',
          },
        ],
      });

    const response = await request(app)
      .get('/vocab/entries?q=MITI&topic=environment&cefr=B2&page=1&pageSize=1')
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(1);
    expect(response.body.entries[0].lemma).toBe('mitigate');
    expect(response.body.pagination).toEqual({page: 1, pageSize: 1, total: 1, totalPages: 1});
    expect(response.body.entries.some((entry: VocabEntry) => entry.id === OTHER_ENTRY_ID)).toBe(false);
  });

  it('allows the owner to update a note and delete an entry', async () => {
    const id = ENTRY_ID;
    await request(app)
      .post('/vocab/entries')
      .set('Authorization', authHeader())
      .send({
        entries: [{headword: 'mitigate', lemma: 'mitigate', partOfSpeech: 'verb', meaningVi: 'giảm nhẹ'}],
      });

    const updated = await request(app)
      .patch(`/vocab/entries/${id}`)
      .set('Authorization', authHeader())
      .send({note: 'Review this word.'});
    const deleted = await request(app).delete(`/vocab/entries/${id}`).set('Authorization', authHeader());

    expect(updated.status).toBe(200);
    expect(updated.body.entry.note).toBe('Review this word.');
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({deleted: true});
  });

  it('hides another user entry from detail, update, and delete operations', async () => {
    const detail = await request(app).get(`/vocab/entries/${OTHER_ENTRY_ID}`).set('Authorization', authHeader());
    const update = await request(app)
      .patch(`/vocab/entries/${OTHER_ENTRY_ID}`)
      .set('Authorization', authHeader())
      .send({note: 'unauthorized'});
    const deletion = await request(app).delete(`/vocab/entries/${OTHER_ENTRY_ID}`).set('Authorization', authHeader());

    expect(detail.status).toBe(404);
    expect(update.status).toBe(404);
    expect(deletion.status).toBe(404);
    expect(repository.entries.has(OTHER_ENTRY_ID)).toBe(true);
  });

  it('documents all vocab entry routes, security, query filters, and response schemas', () => {
    const document = generateOpenApiDocument();
    const paths = document.paths ?? {};

    expect(paths['/api/v1/vocab/entries']?.post).toMatchObject({
      security: [{bearerAuth: []}],
      responses: {201: {description: 'Entries saved or merged.'}},
    });
    expect(paths['/api/v1/vocab/entries']?.get).toMatchObject({
      security: [{bearerAuth: []}],
      parameters: expect.arrayContaining([
        expect.objectContaining({name: 'q'}),
        expect.objectContaining({name: 'pageSize'}),
      ]),
    });
    expect(paths['/api/v1/vocab/entries/{id}']?.get).toBeDefined();
    expect(paths['/api/v1/vocab/entries/{id}']?.patch).toBeDefined();
    expect(paths['/api/v1/vocab/entries/{id}']?.delete).toBeDefined();
  });
});
