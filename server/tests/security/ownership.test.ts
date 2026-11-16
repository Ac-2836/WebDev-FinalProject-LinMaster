import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {seedSampleTests} from '../../prisma/seed-tests';
import {createApp} from '../../src/app';
import {getDb} from '../../src/core/db';
import {signJwt} from '../../src/core/jwt';

const JWT_SECRET = 'ownership-test-secret-that-is-at-least-32-chars';
const run = `${Date.now()}`;
const emails = [`owner-${run}@linmaster.test`, `intruder-${run}@linmaster.test`];
const EMPTY_STATE = {answers: {}, highlights: [], notes: [], flags: [], position: null};

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

// P5-02: the real app and database. The intruder calls every route that names content of the owner (in the URL or
// in the body) and must get 403 or 404; afterwards the owner's content is unchanged.
describe('ownership on every route', () => {
  const db = getDb();
  const app = createApp({NODE_ENV: 'test', JWT_SECRET, CORS_ORIGINS: []});
  const ids = {} as Record<
    'owner' | 'intruder' | 'document' | 'entry' | 'set' | 'card' | 'session' | 'test' | 'passage' | 'file' | 'import',
    string
  > & {attempt: string; submitted: string};

  const call = (userId: string, method: Method, path: string, body?: object) =>
    request(app)
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${signJwt(userId, JWT_SECRET)}`)
      .send(body);

  beforeAll(async () => {
    const [owner, intruder] = await Promise.all(
      emails.map(email => db.user.create({data: {email, passwordHash: 'x', displayName: 'Ownership'}})),
    );
    ids.owner = owner.id;
    ids.intruder = intruder.id;
    const paragraphs = [{text: 'Trees mitigate heat in cities.'}];
    ids.document = (
      await db.document.create({
        data: {ownerId: owner.id, title: 'Private', source: 'paste', paragraphs, wordCount: 5},
      })
    ).id;
    ids.entry = (
      await db.vocabEntry.create({
        data: {
          ownerId: owner.id,
          headword: 'mitigate',
          lemma: 'mitigate',
          partOfSpeech: 'verb',
          meaningVi: '-',
          topics: [],
          collocations: [],
        },
      })
    ).id;
    const set = await db.flashcardSet.create({
      data: {ownerId: owner.id, title: 'Private set', cards: {create: {position: 0, term: 'a', definition: 'b'}}},
      include: {cards: true},
    });
    ids.set = set.id;
    ids.card = set.cards[0].id;
    ids.session = (await db.studySession.create({data: {userId: owner.id, setId: set.id, mode: 'flip'}})).id;

    await seedSampleTests(db, owner.id);
    const test = await db.test.findFirstOrThrow({where: {ownerId: owner.id, kind: 'listening'}});
    ids.test = test.id;
    ids.passage = (await db.passage.findFirstOrThrow({where: {section: {testId: test.id}}})).id;
    const file = {ownerId: owner.id, storageKey: `ownership/${run}.pdf`, mimeType: 'application/pdf', sizeBytes: 10};
    ids.file = (await db.storedFile.create({data: {...file, originalName: 'test.pdf'}})).id;
    ids.import = (
      await db.testImport.create({
        data: {
          ownerId: owner.id,
          kind: 'listening',
          questionFileId: ids.file,
          answerFileId: ids.file,
          audioFileId: ids.file,
        },
      })
    ).id;
    const attempt = (submitted: boolean) =>
      db.attempt.create({
        data: {
          userId: owner.id,
          testId: test.id,
          deadlineAt: new Date(Date.now() + 3_600_000),
          state: EMPTY_STATE,
          ...(submitted && {status: 'submitted' as const, submittedAt: new Date(), startedAt: new Date(0)}),
        },
      });
    ids.submitted = (await attempt(true)).id;
    ids.attempt = (await attempt(false)).id;
  });

  afterAll(async () => {
    await db.user.deleteMany({where: {email: {in: emails}}});
    await db.$disconnect();
  });

  const routes = (): Array<[Method, string, object?]> => [
    ['get', `/vocab/documents/${ids.document}`],
    ['delete', `/vocab/documents/${ids.document}`],
    ['post', `/vocab/documents/${ids.document}/scan`, {}],
    ['post', '/vocab/documents/from-exam', {attemptId: ids.submitted, passageId: ids.passage}],
    ['post', '/vocab/lookups', {text: 'mitigate', sentence: 'Trees mitigate heat.', documentId: ids.document}],
    ['get', `/vocab/entries/${ids.entry}`],
    ['patch', `/vocab/entries/${ids.entry}`, {note: 'mine now'}],
    ['delete', `/vocab/entries/${ids.entry}`],
    ['get', `/flashcards/sets/${ids.set}`],
    ['patch', `/flashcards/sets/${ids.set}`, {title: 'Mine now'}],
    ['put', `/flashcards/sets/${ids.set}/cards`, {cards: []}],
    ['delete', `/flashcards/sets/${ids.set}`],
    ['get', `/flashcards/sets/${ids.set}/study`],
    ['post', '/flashcards/sets/from-vocab', {title: 'Stolen', vocabIds: [ids.entry]}],
    ['post', '/flashcards/sessions', {setId: ids.set, mode: 'flip'}],
    ['patch', `/flashcards/sessions/${ids.session}`, {}],
    ['post', '/flashcards/reviews', {cardId: ids.card, rating: 'good'}],
    ['get', `/tests/${ids.test}`],
    ['patch', `/tests/${ids.test}`, {title: 'Mine now'}],
    ['delete', `/tests/${ids.test}`],
    ['get', `/tests/imports/${ids.import}`],
    ['delete', `/tests/imports/files/${ids.file}`],
    ['post', '/tests/imports', {kind: 'reading', files: [{fileId: ids.file}]}],
    ['post', '/attempts', {testId: ids.test}],
    ['get', `/attempts/${ids.attempt}`],
    ['put', `/attempts/${ids.attempt}/state`, {state: EMPTY_STATE}],
    ['post', `/attempts/${ids.attempt}/submit`],
    ['get', `/attempts/${ids.submitted}/result`],
    ['get', `/attempts/${ids.attempt}/audio`],
    ['post', `/library/sets/${ids.set}/publish`],
    ['post', `/library/sets/${ids.set}/unpublish`],
    ['post', `/library/tests/${ids.test}/publish`],
    ['post', `/library/tests/${ids.test}/unpublish`],
    ['get', `/library/sets/${ids.set}`],
    ['get', `/library/tests/${ids.test}`],
    ['post', `/library/sets/${ids.set}/copy`],
    ['post', '/library/reports', {targetType: 'set', targetId: ids.set, reason: 'other'}],
  ];

  it('refuses the intruder on every route that names content of the owner', async () => {
    const refused: string[] = [];
    for (const [method, path, body] of routes()) {
      const response = await call(ids.intruder, method, path, body);
      // "Resource not found." comes from the catch-all of unknown routes: the path in this list would be wrong.
      const unknownRoute = response.body.error?.message === 'Resource not found.';
      if (![403, 404].includes(response.status) || unknownRoute) refused.push(`${method} ${path} → ${response.status}`);
    }
    expect(refused).toEqual([]);
  });

  it('leaves the owner content unchanged and out of the intruder lists', async () => {
    expect(await db.document.count({where: {id: ids.document}})).toBe(1);
    expect(await db.vocabEntry.findUniqueOrThrow({where: {id: ids.entry}})).toMatchObject({note: null});
    expect(await db.flashcardSet.findUniqueOrThrow({where: {id: ids.set}})).toMatchObject({
      title: 'Private set',
      visibility: 'private',
    });
    expect(await db.card.count({where: {setId: ids.set}})).toBe(1);
    expect(await db.test.findUniqueOrThrow({where: {id: ids.test}})).toMatchObject({visibility: 'private'});
    expect(await db.attempt.findUniqueOrThrow({where: {id: ids.attempt}})).toMatchObject({status: 'in_progress'});
    expect(await db.storedFile.count({where: {id: ids.file}})).toBe(1);
    expect(await db.report.count({where: {targetId: ids.set}})).toBe(0);
    expect(await db.flashcardSet.count({where: {ownerId: ids.intruder}})).toBe(0);

    for (const path of ['/vocab/documents', '/vocab/entries', '/flashcards/sets', '/tests', '/attempts']) {
      const body = JSON.stringify((await call(ids.intruder, 'get', path).expect(200)).body);
      for (const id of [ids.document, ids.entry, ids.set, ids.test, ids.attempt, ids.submitted]) {
        expect(body).not.toContain(id);
      }
    }
  });

  it('still lets the owner reach the same content', async () => {
    await call(ids.owner, 'get', `/vocab/documents/${ids.document}`).expect(200);
    await call(ids.owner, 'get', `/flashcards/sets/${ids.set}`).expect(200);
    await call(ids.owner, 'get', `/tests/${ids.test}`).expect(200);
    await call(ids.owner, 'get', `/attempts/${ids.attempt}`).expect(200);
    await call(ids.owner, 'get', `/attempts/${ids.submitted}/result`).expect(200);
  });

  it('counts only the own data in stats', async () => {
    expect((await call(ids.owner, 'get', '/stats/overview').expect(200)).body.testsTaken).toBe(1);
    expect((await call(ids.intruder, 'get', '/stats/overview').expect(200)).body.testsTaken).toBe(0);
    await db.flashcardSet.update({where: {id: ids.set}, data: {visibility: 'public', copyCount: 3}});
    expect((await call(ids.intruder, 'get', '/stats/community').expect(200)).body).toMatchObject({
      publishedSets: 0,
      setCopies: 0,
    });
  });

  it('never sends answers, explanations, transcripts or storage keys of a public test before submitting', async () => {
    // A Listening test with everything a leak could carry: answers with explanations, a transcript and audio.
    await db.test.update({where: {id: ids.test}, data: {visibility: 'public', source: 'Cambridge'}});
    await db.passage.updateMany({
      where: {section: {testId: ids.test}},
      data: {paragraphs: [{label: 'A', text: 'SECRET TRANSCRIPT'}]},
    });
    await db.question.updateMany({
      where: {group: {passage: {section: {testId: ids.test}}}},
      data: {answer: {accepted: ['SECRET ANSWER'], explanation: 'SECRET EXPLANATION'}},
    });
    await db.testSection.updateMany({where: {testId: ids.test}, data: {audioFileId: ids.file}});

    const started = await call(ids.intruder, 'post', '/attempts', {testId: ids.test}).expect(201);
    const responses = [
      (await call(ids.intruder, 'get', `/tests/${ids.test}`).expect(200)).body,
      (await call(ids.intruder, 'get', `/library/tests/${ids.test}`).expect(200)).body,
      started.body,
      (await call(ids.intruder, 'get', `/attempts/${started.body.attempt.id}`).expect(200)).body,
    ];
    for (const body of responses) {
      const keys = new Set<string>();
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') {
          for (const [key, child] of Object.entries(value)) {
            keys.add(key);
            if (key === 'paragraphs') expect(child).toBeNull();
            walk(child);
          }
        }
      };
      walk(body);
      for (const key of ['answer', 'accepted', 'explanation', 'storageKey', 'transcripts']) {
        expect(keys).not.toContain(key);
      }
      expect(JSON.stringify(body)).not.toMatch(/SECRET/u);
    }
  });
});
