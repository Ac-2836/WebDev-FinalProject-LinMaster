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
import {EXERCISE_FAILURE_COOLDOWN_MS} from '../../src/modules/flashcard/flashcard.service';
import type {ExerciseGenerator, VocabEntryProvider} from '../../src/modules/flashcard/flashcard.service';
import {AppError} from '../../src/core/app-error';
import {createFlashcardModule} from '../../src/modules/flashcard';

const JWT_SECRET = 'flashcard-test-secret-that-is-at-least-32-characters';
const OWNER_ID = '0192f7e0-0bcd-7000-8000-000000000031';
const OTHER_USER_ID = '0192f7e0-0bcd-7000-8000-000000000032';
const SET_ID = '0192f7e0-0bcd-7000-8000-000000000033';
const OTHER_SET_ID = '0192f7e0-0bcd-7000-8000-000000000034';
const CARD_ID = '0192f7e0-0bcd-7000-8000-000000000035';
const OWN_FOUR_SET_ID = '0192f7e0-0bcd-7000-8000-000000000061';
const PUBLIC_SET_ID = '0192f7e0-0bcd-7000-8000-000000000060';
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
  const quizCards = ['apple', 'bread', 'cloud', 'dream'].map((word, position) =>
    makeCard({
      id: `0192f7e0-0bcd-7000-8000-${String(70 + position).padStart(12, '0')}`,
      term: word,
      definition: `${word}-vi`,
      position,
    }),
  );
  sets.set(PUBLIC_SET_ID, {ownerId: OTHER_USER_ID, set: makeSet({id: PUBLIC_SET_ID, cards: quizCards})});
  sets.set(OWN_FOUR_SET_ID, {ownerId: OWNER_ID, set: makeSet({id: OWN_FOUR_SET_ID, cards: quizCards})});
  const publicIds = new Set([PUBLIC_SET_ID]);
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
    async findReadableSet(userId, id) {
      const record = sets.get(id);
      return record && (record.ownerId === userId || publicIds.has(id)) ? record.set : null;
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

let clockMs = 0;

function createTestServer(
  repository: FlashcardRepository,
  vocabEntries: VocabEntryProvider,
  exercises?: ExerciseGenerator,
) {
  const app = express();
  app.use(express.json());
  const now = () => new Date(clockMs);
  app.use(createFlashcardModule(JWT_SECRET, repository, vocabEntries, undefined, now, exercises).router);
  app.use(errorMiddleware);
  return app;
}

function authHeader(userId = OWNER_ID) {
  return `Bearer ${signJwt(userId, JWT_SECRET)}`;
}

describe('flashcard API', () => {
  let repository: ReturnType<typeof makeRepository>;
  let app: express.Express;
  let generated: Awaited<ReturnType<ExerciseGenerator>>;
  let generatorCalls: Parameters<ExerciseGenerator>[];

  beforeEach(() => {
    repository = makeRepository();
    const vocabEntries: VocabEntryProvider = {
      async getEntriesForUser(ownerId, ids) {
        return ownerId === OWNER_ID && ids.includes(VOCAB_ID) ? [makeVocabEntry()] : [];
      },
    };
    generatorCalls = [];
    clockMs = 0;
    const completion = (prompt: string, answer: string) => ({
      kind: 'completion' as const,
      prompt,
      options: [],
      answer,
      items: [],
    });
    generated = {
      questions: [
        completion('We {{blank}} the plan.', 'zebra'),
        completion('We eat bread.', 'bread'),
        completion('We eat {{blank}} daily.', 'APPLE'),
        completion('Then we bake {{blank}}.', 'bread'),
        completion('The {{blank}} is grey today.', 'cloud'),
        completion('I had a strange {{blank}}.', 'dream'),
        completion('She ate an {{blank}} too.', 'apple'),
      ],
    };
    app = createTestServer(repository, vocabEntries, async (...args) => {
      generatorCalls.push(args);
      return generated;
    });
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

  it('builds a quiz for the owner and for a public set, and hides the rest', async () => {
    const anonymous = await request(app).get(`/flashcards/sets/${PUBLIC_SET_ID}/quiz`);
    expect(anonymous.status).toBe(401);

    const publicQuiz = await request(app)
      .get(`/flashcards/sets/${PUBLIC_SET_ID}/quiz?count=3&kinds=written`)
      .set('Authorization', authHeader());
    expect(publicQuiz.status).toBe(200);
    expect(publicQuiz.body.setId).toBe(PUBLIC_SET_ID);
    expect(publicQuiz.body.questions).toHaveLength(3);
    expect(publicQuiz.body.questions.every((q: {kind: string}) => q.kind === 'written')).toBe(true);

    // OTHER_SET_ID is private and owned by someone else; SET_ID has one card for its owner.
    const foreign = await request(app).get(`/flashcards/sets/${OTHER_SET_ID}/quiz`).set('Authorization', authHeader());
    const missing = await request(app)
      .get('/flashcards/sets/0192f7e0-0bcd-7000-8000-000000000099/quiz')
      .set('Authorization', authHeader());
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
  });

  it('needs four cards and a valid query for a quiz', async () => {
    const tooSmall = await request(app).get(`/flashcards/sets/${SET_ID}/quiz`).set('Authorization', authHeader());
    const badKind = await request(app)
      .get(`/flashcards/sets/${PUBLIC_SET_ID}/quiz?kinds=essay`)
      .set('Authorization', authHeader());
    const badCount = await request(app)
      .get(`/flashcards/sets/${PUBLIC_SET_ID}/quiz?count=51`)
      .set('Authorization', authHeader());
    const badId = await request(app).get('/flashcards/sets/not-a-uuid/quiz').set('Authorization', authHeader());

    expect(tooSmall.status).toBe(422);
    expect([badKind.status, badCount.status, badId.status]).toEqual([400, 400, 400]);
  });

  it('generates AI practice for the owner with only the questions that pass the checks', async () => {
    const response = await request(app)
      .post(`/flashcards/sets/${OWN_FOUR_SET_ID}/exercises`)
      .set('Authorization', authHeader())
      .send({kinds: ['completion'], count: 10});

    expect(response.status).toBe(200);
    expect(response.body.setId).toBe(OWN_FOUR_SET_ID);
    // "APPLE" is written as in the set; a word outside the set, a sentence with no gap and a second question about
    // the same card are dropped.
    expect(response.body.questions.map((q: {answer: string}) => q.answer)).toEqual([
      'apple',
      'bread',
      'cloud',
      'dream',
    ]);
    expect(generatorCalls).toHaveLength(1);
    expect(generatorCalls[0]![0]).toMatchObject({kinds: ['completion'], count: 10});
    expect(generatorCalls[0]![0].cards.map((card: {term: string}) => card.term)).toEqual([
      'apple',
      'bread',
      'cloud',
      'dream',
    ]);
    expect(generatorCalls[0]![1]).toBe(OWNER_ID);
  });

  it('answers 502 when under half of the practice questions are valid', async () => {
    generated = {questions: generated.questions.slice(0, 3)};

    const response = await request(app)
      .post(`/flashcards/sets/${OWN_FOUR_SET_ID}/exercises`)
      .set('Authorization', authHeader())
      .send({kinds: ['completion'], count: 10});

    expect(response.status).toBe(502);
    expect(response.body.error.status).toBe('AI_INVALID_OUTPUT');
  });

  it('does not call the AI again for a minute after a request that failed', async () => {
    generated = {questions: generated.questions.slice(0, 3)};
    const ask = (kinds = ['completion']) =>
      request(app)
        .post(`/flashcards/sets/${OWN_FOUR_SET_ID}/exercises`)
        .set('Authorization', authHeader())
        .send({kinds, count: 10});

    const first = await ask();
    const again = await ask();
    const otherRequest = await ask(['completion', 'matching']);
    clockMs += EXERCISE_FAILURE_COOLDOWN_MS + 1;
    const later = await ask();

    expect([first.status, again.status, otherRequest.status, later.status]).toEqual([502, 502, 502, 502]);
    expect(again.body.error.status).toBe('AI_INVALID_OUTPUT');
    // The same request is refused without the model; a different one and one after the minute call it.
    expect(generatorCalls).toHaveLength(3);
  });

  it('remembers a failure that the AI gateway reports, but not an unreachable model', async () => {
    let error: Error = new AppError('bad output', 502, undefined, 'AI_INVALID_OUTPUT');
    let calls = 0;
    app = createTestServer(repository, {getEntriesForUser: async () => []}, async () => {
      calls += 1;
      throw error;
    });
    const ask = () =>
      request(app)
        .post(`/flashcards/sets/${OWN_FOUR_SET_ID}/exercises`)
        .set('Authorization', authHeader())
        .send({kinds: ['completion'], count: 10});

    await ask();
    const remembered = await ask();
    error = new AppError('down', 503, undefined, 'AI_UNAVAILABLE');
    clockMs += EXERCISE_FAILURE_COOLDOWN_MS + 1;
    const unavailable = await ask();
    const unavailableAgain = await ask();

    expect(remembered.body.error.status).toBe('AI_INVALID_OUTPUT');
    expect([unavailable.status, unavailableAgain.status]).toEqual([503, 503]);
    expect(calls).toBe(3);
  });

  it('keeps AI practice to the owner, to sets of four cards and to valid requests, without calling the AI', async () => {
    const send = (setId: string, body: object, userId = OWNER_ID) =>
      request(app).post(`/flashcards/sets/${setId}/exercises`).set('Authorization', authHeader(userId)).send(body);
    const valid = {kinds: ['completion'], count: 10};

    const anonymous = await request(app).post(`/flashcards/sets/${OWN_FOUR_SET_ID}/exercises`).send(valid);
    const foreign = await send(OWN_FOUR_SET_ID, valid, OTHER_USER_ID);
    const publicSet = await send(PUBLIC_SET_ID, valid);
    const tooSmall = await send(SET_ID, valid);
    const bad = await Promise.all([
      send(OWN_FOUR_SET_ID, {kinds: ['completion'], count: 15}),
      send(OWN_FOUR_SET_ID, {kinds: [], count: 10}),
      send(OWN_FOUR_SET_ID, {kinds: ['completion', 'completion'], count: 10}),
      send(OWN_FOUR_SET_ID, {kinds: ['essay'], count: 10}),
      send('not-a-uuid', valid),
    ]);

    expect(anonymous.status).toBe(401);
    expect([foreign.status, publicSet.status]).toEqual([404, 404]);
    expect(tooSmall.status).toBe(422);
    expect(bad.map(r => r.status)).toEqual([400, 400, 400, 400, 400]);
    expect(generatorCalls).toHaveLength(0);
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
    expect(paths['/api/v1/flashcards/sets/{id}/exercises']?.post).toMatchObject({security: [{bearerAuth: []}]});
    expect(paths['/api/v1/flashcards/sets/{id}/quiz']?.get).toMatchObject({security: [{bearerAuth: []}]});
  });
});
