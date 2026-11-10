import express from 'express';
import request from 'supertest';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  MAX_CARDS_PER_SET,
  MAX_DEFINITION_LENGTH,
  MAX_EXAMPLE_LENGTH,
  MAX_SET_DESCRIPTION_LENGTH,
  MAX_TERM_LENGTH,
} from '@linmaster/shared';
import type {FlashcardCard, FlashcardSet, VocabEntry} from '@linmaster/shared';
import {errorMiddleware} from '../../src/core/error.middleware';
import {generateOpenApiDocument} from '../../src/core/openapi-registry';
import {signJwt} from '../../src/core/jwt';
import type {FlashcardRepository, FlashcardSetSummary} from '../../src/modules/flashcard/flashcard.repository';
import {
  FlashcardCardNotFoundError,
  FlashcardVocabEntryNotFoundError,
} from '../../src/modules/flashcard/flashcard.repository';
import type {VocabEntryProvider} from '../../src/modules/flashcard/flashcard.service';
import {createFlashcardModule} from '../../src/modules/flashcard';

const JWT_SECRET = 'flashcard-test-secret-that-is-at-least-32-characters';
const OWNER_ID = '0192f7e0-0bcd-7000-8000-000000000031';
const OTHER_USER_ID = '0192f7e0-0bcd-7000-8000-000000000032';
const SET_ID = '0192f7e0-0bcd-7000-8000-000000000033';
const OTHER_SET_ID = '0192f7e0-0bcd-7000-8000-000000000034';
const CARD_ID = '0192f7e0-0bcd-7000-8000-000000000035';
const OTHER_CARD_ID = '0192f7e0-0bcd-7000-8000-000000000036';
const VOCAB_ID = '0192f7e0-0bcd-7000-8000-000000000037';
const OTHER_VOCAB_ID = '0192f7e0-0bcd-7000-8000-000000000038';
const TIMESTAMP = '2026-01-01T00:00:00.000Z';

function makeCard(overrides: Partial<FlashcardCard> = {}): FlashcardCard {
  return {
    id: CARD_ID,
    term: 'mitigate',
    definition: 'giảm nhẹ',
    example: 'The policy mitigated the impact.',
    vocabEntryId: VOCAB_ID,
    position: 0,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

function makeSet(overrides: Partial<FlashcardSet> = {}): FlashcardSet {
  return {
    id: SET_ID,
    title: 'Environment vocabulary',
    description: null,
    termLang: 'en',
    definitionLang: 'vi',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    cards: [makeCard()],
    ...overrides,
  };
}

function makeVocabEntry(id = VOCAB_ID): VocabEntry {
  return {
    id,
    headword: 'mitigated',
    lemma: 'mitigate',
    partOfSpeech: 'verb',
    ipa: null,
    meaningVi: 'giảm nhẹ',
    definitionEn: null,
    usageNote: null,
    collocations: [],
    cefr: null,
    topics: [],
    note: null,
    contexts: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function makeRepository(): FlashcardRepository & {sets: Map<string, {ownerId: string; set: FlashcardSet}>} {
  const sets = new Map<string, {ownerId: string; set: FlashcardSet}>([
    [SET_ID, {ownerId: OWNER_ID, set: makeSet()}],
    [OTHER_SET_ID, {ownerId: OTHER_USER_ID, set: makeSet({id: OTHER_SET_ID, cards: [makeCard({id: OTHER_CARD_ID})]})}],
  ]);
  let createdSetNumber = 0;
  let createdCardNumber = 50;

  return {
    sets,
    async createSet(ownerId, input, cards = []) {
      createdSetNumber += 1;
      const id =
        createdSetNumber === 1 ? '0192f7e0-0bcd-7000-8000-000000000039' : '0192f7e0-0bcd-7000-8000-000000000040';
      const set = makeSet({
        ...input,
        id,
        cards: cards.map((card, position) =>
          makeCard({
            ...card,
            id: `0192f7e0-0bcd-7000-8000-${String(41 + position).padStart(12, '0')}`,
            position,
          }),
        ),
      });
      sets.set(id, {ownerId, set});
      return set;
    },
    async listSets(ownerId) {
      return [...sets.values()]
        .filter(record => record.ownerId === ownerId)
        .map(
          ({set}) =>
            ({
              id: set.id,
              title: set.title,
              description: set.description,
              termLang: set.termLang,
              definitionLang: set.definitionLang,
              createdAt: new Date(set.createdAt),
              updatedAt: new Date(set.updatedAt),
              _count: {cards: set.cards.length},
            }) satisfies FlashcardSetSummary,
        );
    },
    async findSet(ownerId, id) {
      const record = sets.get(id);
      return record?.ownerId === ownerId ? record.set : null;
    },
    async updateSet(ownerId, id, input) {
      const record = sets.get(id);
      if (record?.ownerId !== ownerId) return null;
      const set = {...record.set, ...input};
      sets.set(id, {ownerId, set});
      return set;
    },
    async deleteSet(ownerId, id) {
      const record = sets.get(id);
      if (record?.ownerId !== ownerId) return false;
      sets.delete(id);
      return true;
    },
    async replaceCards(ownerId, setId, cards) {
      const record = sets.get(setId);
      if (record?.ownerId !== ownerId) return null;
      const currentCards = new Map(record.set.cards.map(card => [card.id, card]));
      const saved = cards.map((card, position) => {
        if (card.id && !currentCards.has(card.id)) throw new FlashcardCardNotFoundError();
        if (card.vocabEntryId && card.vocabEntryId !== VOCAB_ID) throw new FlashcardVocabEntryNotFoundError();
        const existing = card.id ? currentCards.get(card.id) : undefined;
        const id = existing?.id ?? `0192f7e0-0bcd-7000-8000-${String(createdCardNumber++).padStart(12, '0')}`;
        return makeCard({...existing, ...card, id, position});
      });
      const set = {...record.set, cards: saved};
      sets.set(setId, {ownerId, set});
      return saved;
    },
  };
}

function createTestServer(repository: FlashcardRepository, vocabEntries: VocabEntryProvider) {
  const app = express();
  app.use(express.json());
  app.use(createFlashcardModule(JWT_SECRET, repository, vocabEntries).router);
  app.use(errorMiddleware);
  return app;
}

function authHeader(userId = OWNER_ID) {
  return `Bearer ${signJwt(userId, JWT_SECRET)}`;
}

describe('flashcard API', () => {
  let repository: ReturnType<typeof makeRepository>;
  let app: express.Express;

  beforeEach(() => {
    repository = makeRepository();
    const vocabEntries: VocabEntryProvider = {
      async getEntriesForUser(ownerId, ids) {
        return ownerId === OWNER_ID && ids.includes(VOCAB_ID) ? [makeVocabEntry()] : [];
      },
    };
    app = createTestServer(repository, vocabEntries);
  });

  it('requires authentication and supports set CRUD for its owner', async () => {
    expect((await request(app).get('/flashcards/sets')).status).toBe(401);

    const created = await request(app)
      .post('/flashcards/sets')
      .set('Authorization', authHeader())
      .send({title: '  New set  '});
    const listed = await request(app).get('/flashcards/sets').set('Authorization', authHeader());
    const updated = await request(app)
      .patch(`/flashcards/sets/${SET_ID}`)
      .set('Authorization', authHeader())
      .send({title: 'Updated set'});
    const deleted = await request(app).delete(`/flashcards/sets/${SET_ID}`).set('Authorization', authHeader());

    expect(created.status).toBe(201);
    expect(created.body.set.title).toBe('New set');
    expect(listed.body.sets).toEqual(expect.arrayContaining([expect.objectContaining({id: SET_ID, cardCount: 1})]));
    expect(listed.body.sets.map((set: {id: string}) => set.id)).not.toContain(OTHER_SET_ID);
    expect(updated.body.set.title).toBe('Updated set');
    expect(deleted.body).toEqual({deleted: true});
  });

  it('hides another owner set from detail, update, delete, and card replacement', async () => {
    const detail = await request(app).get(`/flashcards/sets/${OTHER_SET_ID}`).set('Authorization', authHeader());
    const update = await request(app)
      .patch(`/flashcards/sets/${OTHER_SET_ID}`)
      .set('Authorization', authHeader())
      .send({title: 'stolen'});
    const deletion = await request(app).delete(`/flashcards/sets/${OTHER_SET_ID}`).set('Authorization', authHeader());
    const cards = await request(app)
      .put(`/flashcards/sets/${OTHER_SET_ID}/cards`)
      .set('Authorization', authHeader())
      .send({cards: []});

    expect(detail.status).toBe(404);
    expect(update.status).toBe(404);
    expect(deletion.status).toBe(404);
    expect(cards.status).toBe(404);
    expect(repository.sets.has(OTHER_SET_ID)).toBe(true);
  });

  it('replaces the ordered card list while retaining IDs of cards supplied by the editor', async () => {
    const response = await request(app)
      .put(`/flashcards/sets/${SET_ID}/cards`)
      .set('Authorization', authHeader())
      .send({
        cards: [
          {id: CARD_ID, term: 'mitigates', definition: 'giảm nhẹ hơn'},
          {term: 'resilient', definition: 'kiên cường'},
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.cards).toHaveLength(2);
    expect(response.body.cards[0]).toMatchObject({id: CARD_ID, term: 'mitigates', position: 0});
    expect(response.body.cards[1]).toMatchObject({term: 'resilient', position: 1});
  });

  it('limits the number of cards and the length of card and set text', async () => {
    const card = (i: number) => ({term: `term ${i}`, definition: `definition ${i}`});
    const replace = (cards: unknown[]) =>
      request(app).put(`/flashcards/sets/${SET_ID}/cards`).set('Authorization', authHeader()).send({cards});

    const atLimit = await replace(Array.from({length: MAX_CARDS_PER_SET}, (_, i) => card(i)));
    const overLimit = await replace(Array.from({length: MAX_CARDS_PER_SET + 1}, (_, i) => card(i)));
    const longTerm = await replace([{term: 'x'.repeat(MAX_TERM_LENGTH + 1), definition: 'd'}]);
    const longDefinition = await replace([{term: 't', definition: 'x'.repeat(MAX_DEFINITION_LENGTH + 1)}]);
    const longExample = await replace([{term: 't', definition: 'd', example: 'x'.repeat(MAX_EXAMPLE_LENGTH + 1)}]);
    const longDescription = await request(app)
      .post('/flashcards/sets')
      .set('Authorization', authHeader())
      .send({title: 'Set', description: 'x'.repeat(MAX_SET_DESCRIPTION_LENGTH + 1)});
    const longDescriptionUpdate = await request(app)
      .patch(`/flashcards/sets/${SET_ID}`)
      .set('Authorization', authHeader())
      .send({description: 'x'.repeat(MAX_SET_DESCRIPTION_LENGTH + 1)});

    expect(atLimit.status).toBe(200);
    expect(atLimit.body.cards).toHaveLength(MAX_CARDS_PER_SET);
    expect(overLimit.status).toBe(400);
    expect(longTerm.status).toBe(400);
    expect(longDefinition.status).toBe(400);
    expect(longExample.status).toBe(400);
    expect(longDescription.status).toBe(400);
    expect(longDescriptionUpdate.status).toBe(400);
  });

  it('creates a set from owned vocabulary entries and rejects entries owned by someone else', async () => {
    const created = await request(app)
      .post('/flashcards/sets/from-vocab')
      .set('Authorization', authHeader())
      .send({title: 'From vocab', vocabIds: [VOCAB_ID]});
    const forbiddenEntry = await request(app)
      .post('/flashcards/sets/from-vocab')
      .set('Authorization', authHeader())
      .send({title: 'Not mine', vocabIds: [OTHER_VOCAB_ID]});

    expect(created.status).toBe(201);
    expect(created.body.set.cards).toMatchObject([{term: 'mitigated', definition: 'giảm nhẹ', vocabEntryId: VOCAB_ID}]);
    expect(forbiddenEntry.status).toBe(404);
  });

  it('documents all flashcard routes and requires bearer authentication', () => {
    const paths = generateOpenApiDocument().paths ?? {};

    expect(paths['/api/v1/flashcards/sets']?.post).toMatchObject({security: [{bearerAuth: []}]});
    expect(paths['/api/v1/flashcards/sets']?.get).toBeDefined();
    expect(paths['/api/v1/flashcards/sets/{id}']?.get).toBeDefined();
    expect(paths['/api/v1/flashcards/sets/{id}']?.patch).toBeDefined();
    expect(paths['/api/v1/flashcards/sets/{id}']?.delete).toBeDefined();
    expect(paths['/api/v1/flashcards/sets/{id}/cards']?.put).toBeDefined();
    expect(paths['/api/v1/flashcards/sets/from-vocab']?.post).toBeDefined();
  });
});
