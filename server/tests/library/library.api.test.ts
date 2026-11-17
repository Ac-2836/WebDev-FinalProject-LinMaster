import {
  LibraryListResponseSchema,
  LibrarySetPreviewResponseSchema,
  LibraryTestPreviewResponseSchema,
} from '@linmaster/shared';
import express from 'express';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {seedSampleTests} from '../../prisma/seed-tests';
import {getDb} from '../../src/core/db';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {createLibraryModule} from '../../src/modules/library';

const JWT_SECRET = 'library-test-secret-that-is-at-least-32-characters';
const run = `${Date.now()}`;
// Another token for the sets of the later tests, so the searches of the earlier ones do not see them.
const other = [...run].reverse().join('');
const emails = ['owner', 'a', 'b', 'c'].map(name => `library-${name}-${run}@linmaster.test`);

// Real database and the real public APIs of flashcard and exam.
describe('library API', () => {
  const db = getDb();
  const app = express();
  app.use(express.json());
  app.use(createLibraryModule(JWT_SECRET).router);
  app.use(errorMiddleware);
  let owner: string;
  let others: string[];
  let setId: string;
  let readingId: string;
  let listeningId: string;

  const as = (userId: string) => {
    const token = `Bearer ${signJwt(userId, JWT_SECRET)}`;
    return {
      get: (path: string) => request(app).get(path).set('Authorization', token),
      post: (path: string, body?: object) => request(app).post(path).set('Authorization', token).send(body),
    };
  };
  const browse = async (query: string) =>
    LibraryListResponseSchema.parse((await as(others[0]).get(`/library?${query}`).expect(200)).body);

  const report = (userId: string, targetType: 'set' | 'test', targetId: string) =>
    as(userId).post('/library/reports', {targetType, targetId, reason: 'wrong_content'});

  beforeAll(async () => {
    const users = await Promise.all(
      emails.map(email => db.user.create({data: {email, passwordHash: 'x', displayName: 'Library'}})),
    );
    [owner, ...others] = users.map(user => user.id);
    const set = await db.flashcardSet.create({
      data: {
        ownerId: owner,
        title: `Environment ${run}`,
        cards: {createMany: {data: [0, 1].map(position => ({position, term: `term ${position}`, definition: '-'}))}},
      },
    });
    setId = set.id;
    await seedSampleTests(db, owner);
    readingId = (await db.test.findFirstOrThrow({where: {ownerId: owner, kind: 'reading'}})).id;
    listeningId = (await db.test.findFirstOrThrow({where: {ownerId: owner, kind: 'listening'}})).id;
    await db.test.updateMany({where: {ownerId: owner}, data: {title: `Sample ${run}`, source: null}});
  });

  afterAll(async () => {
    await db.report.deleteMany({where: {reporter: {email: {in: emails}}}});
    await db.user.deleteMany({where: {email: {in: emails}}});
    await db.$disconnect();
  });

  it('never shows private content, in the list or by URL', async () => {
    expect((await browse(`q=${run}`)).items).toEqual([]);
    expect((await browse(`type=test&q=${run}`)).items).toEqual([]);
    await as(others[0]).get(`/library/sets/${setId}`).expect(404);
    await as(owner).get(`/library/tests/${readingId}`).expect(404);
    await as(others[0]).post(`/library/sets/${setId}/copy`).expect(404);
    await report(others[0], 'set', setId).expect(404);
  });

  it('lets only the owner publish, and a test needs a source', async () => {
    await as(others[0]).post(`/library/sets/${setId}/publish`).expect(404);
    await as(others[0]).post(`/library/tests/${readingId}/publish`).expect(404);
    const noSource = await as(owner).post(`/library/tests/${readingId}/publish`).expect(409);
    expect(noSource.body.error.status).toBe('TEST_SOURCE_REQUIRED');

    const published = await as(owner).post(`/library/sets/${setId}/publish`).expect(200);
    expect(published.body).toMatchObject({visibility: 'public'});
    const again = await as(owner).post(`/library/sets/${setId}/publish`).expect(200);
    expect(again.body.publishedAt).toBe(published.body.publishedAt);

    await db.test.updateMany({where: {ownerId: owner}, data: {source: 'Cambridge IELTS 18'}});
    for (const id of [readingId, listeningId]) await as(owner).post(`/library/tests/${id}/publish`).expect(200);
  });

  it('lists public content with search, skill filter and sort', async () => {
    const sets = await browse(`q=${run}`);
    expect(sets.items).toMatchObject([{type: 'set', id: setId, cardCount: 2, author: {id: owner}}]);
    expect(sets.pagination).toEqual({page: 1, pageSize: 20, total: 1, totalPages: 1});
    expect((await browse(`q=environment%20${run}`)).items).toHaveLength(1);

    const tests = await browse(`type=test&q=${run}&sort=popular`);
    expect(tests.items.map(item => item.id).sort()).toEqual([readingId, listeningId].sort());
    const listening = await browse(`type=test&q=${run}&skill=listening`);
    expect(listening.items.map(item => item.id)).toEqual([listeningId]);
    await as(owner).get('/library?topic=x').expect(400);
  });

  it('previews a test without its questions, answers or transcripts', async () => {
    const response = await as(others[0]).get(`/library/tests/${readingId}`).expect(200);
    const {test, viewer} = LibraryTestPreviewResponseSchema.parse(response.body);
    expect(test).toMatchObject({id: readingId, source: 'Cambridge IELTS 18', skills: ['reading']});
    expect(test.questionCount).toBeGreaterThan(0);
    expect(test.questionKinds.length).toBeGreaterThan(0);
    expect(viewer).toEqual({isOwner: false, reported: false});

    const question = await db.question.findFirstOrThrow({where: {group: {passage: {section: {testId: readingId}}}}});
    const body = JSON.stringify(response.body);
    for (const key of ['sections', 'passages', 'questions', 'answer', 'paragraphs', 'explanation']) {
      expect(body).not.toContain(`"${key}"`);
    }
    expect(body).not.toContain(question.prompt);
  });

  it('shows the whole set, and refuses to publish hidden content until it is unpublished', async () => {
    const preview = LibrarySetPreviewResponseSchema.parse(
      (await as(others[0]).get(`/library/sets/${setId}`).expect(200)).body,
    );
    expect(preview.set.cards.map(card => card.term)).toEqual(['term 0', 'term 1']);
    expect(preview.viewer).toEqual({isOwner: false, reported: false, copiedSetId: null});

    await db.flashcardSet.update({where: {id: setId}, data: {visibility: 'hidden'}});
    expect((await browse(`q=${run}`)).items).toEqual([]);
    await as(others[0]).get(`/library/sets/${setId}`).expect(404);
    const hidden = await as(owner).post(`/library/sets/${setId}/publish`).expect(409);
    expect(hidden.body.error.status).toBe('CONTENT_HIDDEN');
    await as(owner).post(`/library/sets/${setId}/unpublish`).expect(200);
    await as(owner).post(`/library/sets/${setId}/publish`).expect(200);
    expect((await browse(`q=${run}`)).items).toHaveLength(1);
  });

  it('copies a set into an independent private set', async () => {
    const copied = await as(others[0]).post(`/library/sets/${setId}/copy`).expect(201);
    const copy = await db.flashcardSet.findUniqueOrThrow({where: {id: copied.body.setId}, include: {cards: true}});
    expect(copy).toMatchObject({ownerId: others[0], visibility: 'private', copiedFromId: setId});
    expect(copy.cards.map(card => card.term).sort()).toEqual(['term 0', 'term 1']);

    await db.card.updateMany({where: {setId: copy.id}, data: {term: 'changed'}});
    await db.flashcardSet.update({where: {id: copy.id}, data: {title: 'Mine'}});
    const preview = LibrarySetPreviewResponseSchema.parse(
      (await as(others[0]).get(`/library/sets/${setId}`).expect(200)).body,
    );
    expect(preview.set).toMatchObject({title: `Environment ${run}`, copyCount: 1});
    expect(preview.set.cards.map(card => card.term)).toEqual(['term 0', 'term 1']);
    expect(preview.viewer).toEqual({isOwner: false, reported: false, copiedSetId: copy.id});

    const own = await as(owner).post(`/library/sets/${setId}/copy`).expect(409);
    expect(own.body.error.status).toBe('OWN_CONTENT');
  });

  it('copies a set once: asking again returns the copy and does not count again, even at the same time', async () => {
    const source = await db.flashcardSet.create({
      data: {
        ownerId: owner,
        title: `Once ${other}`,
        visibility: 'public',
        publishedAt: new Date(),
        cards: {createMany: {data: [{position: 0, term: 'one', definition: '-'}]}},
      },
    });
    const copy = () => as(others[1]).post(`/library/sets/${source.id}/copy`);

    const together = await Promise.all([copy(), copy(), copy()]);
    const again = await copy();

    expect(together.map(response => response.status).sort()).toEqual([200, 200, 201]);
    expect(new Set([...together, again].map(response => response.body.setId)).size).toBe(1);
    expect(again.status).toBe(200);
    expect(await db.flashcardSet.count({where: {ownerId: others[1], copiedFromId: source.id}})).toBe(1);
    expect((await db.flashcardSet.findUniqueOrThrow({where: {id: source.id}})).copyCount).toBe(1);

    // After the copy is deleted, copying makes a new one.
    await db.flashcardSet.deleteMany({where: {ownerId: others[1], copiedFromId: source.id}});
    const fresh = await copy();
    expect(fresh.status).toBe(201);
    expect(fresh.body.setId).not.toBe(again.body.setId);
    expect((await db.flashcardSet.findUniqueOrThrow({where: {id: source.id}})).copyCount).toBe(2);
  });

  it('refuses to publish a set without cards until it has one', async () => {
    const empty = await db.flashcardSet.create({data: {ownerId: owner, title: `Empty ${other}`}});

    const refused = await as(owner).post(`/library/sets/${empty.id}/publish`).expect(422);
    expect(refused.body.error.status).toBe('SET_EMPTY');
    expect((await db.flashcardSet.findUniqueOrThrow({where: {id: empty.id}})).visibility).toBe('private');

    await db.card.create({data: {setId: empty.id, position: 0, term: 'one', definition: '-'}});
    await as(owner).post(`/library/sets/${empty.id}/publish`).expect(200);
  });

  it('searches for % and _ as typed, not as wildcards', async () => {
    const make = (title: string) =>
      db.flashcardSet.create({
        data: {
          ownerId: owner,
          title,
          visibility: 'public',
          publishedAt: new Date(),
          cards: {createMany: {data: [{position: 0, term: 'one', definition: '-'}]}},
        },
      });
    await make(`${other} wild_card 50% off`);
    await make(`${other} wildxcard 50 percent`);
    const titles = async (q: string) =>
      (await browse(`q=${encodeURIComponent(q)}`)).items.map(item => item.title).sort();

    expect(await titles(`${other} wild_card`)).toEqual([`${other} wild_card 50% off`]);
    expect(await titles(`${other} wild`)).toHaveLength(2);
    expect(await titles(`${other} wild_card 50%`)).toEqual([`${other} wild_card 50% off`]);
    expect(await titles(`${other} %`)).toEqual([]);
    expect(await titles(`${other} wild_`)).toEqual([`${other} wild_card 50% off`]);
  });

  it('hides content after three reports until the owner unpublishes it', async () => {
    expect((await report(owner, 'set', setId).expect(409)).body.error.status).toBe('OWN_CONTENT');
    await report(others[0], 'set', setId).expect(201, {reported: true});
    expect((await report(others[0], 'set', setId).expect(409)).body.error.status).toBe('ALREADY_REPORTED');
    await report(others[1], 'set', setId).expect(201);
    expect((await browse(`q=${run}`)).items).toHaveLength(1);
    const viewer = (await as(others[0]).get(`/library/sets/${setId}`).expect(200)).body.viewer;
    expect(viewer).toMatchObject({reported: true});
    await report(others[2], 'set', setId).expect(201);

    expect((await browse(`q=${run}`)).items).toEqual([]);
    await as(others[0]).get(`/library/sets/${setId}`).expect(404);
    await report(others[0], 'set', setId).expect(404);
    const hidden = await as(owner).post(`/library/sets/${setId}/publish`).expect(409);
    expect(hidden.body.error.status).toBe('CONTENT_HIDDEN');

    await as(owner).post(`/library/sets/${setId}/unpublish`).expect(200);
    expect(await db.report.count({where: {targetId: setId, status: 'open'}})).toBe(0);
    await as(owner).post(`/library/sets/${setId}/publish`).expect(200);
    expect((await browse(`q=${run}`)).items).toHaveLength(1);
  });

  it('counts reports of tests the same way', async () => {
    await report(others[0], 'test', readingId).expect(201);
    expect((await as(others[0]).get(`/library/tests/${readingId}`).expect(200)).body.viewer.reported).toBe(true);
  });

  it('takes an unpublished test out of the library', async () => {
    await as(owner).post(`/library/tests/${listeningId}/unpublish`).expect(200);
    expect((await browse(`type=test&q=${run}`)).items.map(item => item.id)).toEqual([readingId]);
    await as(others[0]).get(`/library/tests/${listeningId}`).expect(404);
  });
});
