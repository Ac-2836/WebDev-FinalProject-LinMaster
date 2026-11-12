import express from 'express';
import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {ApiErrorBody, CreateVocabDocumentResponseSchema} from '@linmaster/shared';
import {getDb} from '../../src/core/db';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {createVocabModule} from '../../src/modules/vocab';
import {createFixtureTest, testSecrets} from '../exam/exam-fixtures';

const JWT_SECRET = 'exam-documents-test-secret-that-is-at-least-32-characters';
const run = `exam-docs-${Date.now()}`;
const MISSING_ID = '0192f7e0-0bcd-7000-8000-000000000999';

describe('vocab documents from exam passages', () => {
  const db = getDb();
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createVocabModule(JWT_SECRET).router);
  app.use(errorMiddleware);
  const users = {owner: '', other: ''};

  const open = (body: object, userId = users.owner) =>
    request(app)
      .post('/api/v1/vocab/documents/from-exam')
      .set('Authorization', `Bearer ${signJwt(userId, JWT_SECRET)}`)
      .send(body);

  /** The fixture test with an attempt of the owner; returns its Reading and Listening passages. */
  async function attemptOn(title: string, status: 'submitted' | 'in_progress' = 'submitted') {
    const test = await createFixtureTest({ownerId: users.owner, title: `${title} ${run}`, run});
    const attempt = await db.attempt.create({
      data: {
        userId: users.owner,
        testId: test.id,
        status,
        deadlineAt: new Date(),
        submittedAt: status === 'submitted' ? new Date() : null,
        state: {},
      },
    });
    const passages = await db.passage.findMany({
      where: {section: {testId: test.id}},
      select: {id: true, section: {select: {skill: true}}},
    });
    const passageOf = (skill: string) => passages.find(passage => passage.section.skill === skill)!.id;
    return {attemptId: attempt.id, reading: passageOf('reading'), listening: passageOf('listening')};
  }

  beforeAll(async () => {
    const create = (role: string) =>
      db.user.create({data: {email: `exam-docs-${role}-${run}@linmaster.test`, passwordHash: 'x', displayName: role}});
    users.owner = (await create('owner')).id;
    users.other = (await create('other')).id;
  });

  afterAll(async () => {
    await db.user.deleteMany({where: {id: {in: [users.owner, users.other].filter(Boolean)}}});
    await db.$disconnect();
  });

  it('opens a Reading passage of a submitted attempt once, keeping paragraph labels', async () => {
    const {attemptId, reading} = await attemptOn('Reading');

    const created = await open({attemptId, passageId: reading});
    const again = await open({attemptId, passageId: reading});

    expect(created.status).toBe(201);
    expect(CreateVocabDocumentResponseSchema.safeParse(created.body).success).toBe(true);
    expect(created.body.document).toMatchObject({
      title: `Reading ${run}: Urban farming`,
      source: 'exam',
      paragraphs: [{label: 'A', text: 'Farms grow on roofs.'}],
      wordCount: 4,
    });
    expect(again.status).toBe(200);
    expect(again.body.document.id).toBe(created.body.document.id);
    const stored = await db.document.findMany({where: {ownerId: users.owner, source: 'exam', title: {contains: run}}});
    expect(stored).toHaveLength(1);
    expect(stored[0].sourceRef).toEqual({attemptId, passageId: reading});
  });

  it('opens the Listening transcript once submitted', async () => {
    const {attemptId, listening} = await attemptOn('Listening');

    const response = await open({attemptId, passageId: listening});

    expect(response.status).toBe(201);
    expect(response.body.document.paragraphs).toEqual([{label: 'Woman', text: testSecrets(run).transcript}]);
  });

  it('answers 403 before submitting and to another user, and 404 to a passage outside the attempt', async () => {
    const running = await attemptOn('Running', 'in_progress');
    const submitted = await attemptOn('Submitted');

    const early = await open({attemptId: running.attemptId, passageId: running.reading});
    const foreign = await open({attemptId: submitted.attemptId, passageId: submitted.reading}, users.other);
    const elsewhere = await open({attemptId: submitted.attemptId, passageId: running.reading});
    const missing = await open({attemptId: MISSING_ID, passageId: submitted.reading});

    expect(early.status).toBe(403);
    expect(ApiErrorBody.safeParse(early.body).success).toBe(true);
    expect(early.body.error.status).toBe('ATTEMPT_NOT_SUBMITTED');
    expect(foreign.status).toBe(403);
    expect(elsewhere.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(
      await db.document.count({where: {ownerId: {in: [users.owner, users.other]}, title: {contains: 'Running'}}}),
    ).toBe(0);
  });

  it('validates the body and needs a signed-in user', async () => {
    expect((await open({attemptId: 'x', passageId: MISSING_ID})).status).toBe(400);
    expect((await open({attemptId: MISSING_ID, passageId: MISSING_ID, title: 'x'})).status).toBe(400);
    expect((await request(app).post('/api/v1/vocab/documents/from-exam').send({})).status).toBe(401);
  });
});
