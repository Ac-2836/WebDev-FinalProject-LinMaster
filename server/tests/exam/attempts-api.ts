import express from 'express';
import request from 'supertest';
import {getDb} from '../../src/core/db';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {createExamModule, type ExamModuleDeps} from '../../src/modules/exam';
import {createFixtureAudio, createFixtureTest} from './exam-fixtures';

export const START = new Date('2026-11-13T03:00:00.000Z');
export const MINUTE = 60_000;
const JWT_SECRET = 'attempts-api-test-secret-that-is-at-least-32-characters';

/** An app with the exam module on a fixed server clock, two users and a Listening audio file. */
export function setupAttemptsApi(name: string, deps: ExamModuleDeps = {}) {
  const db = getDb();
  const run = `${name}-${Date.now()}`;
  let clock = START;
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createExamModule(JWT_SECRET, {...deps, now: () => clock}).router);
  app.use(errorMiddleware);
  const users = {owner: '', other: ''};
  let audioFileId = '';

  const auth = (userId: string) => `Bearer ${signJwt(userId, JWT_SECRET)}`;
  const as = (userId?: string) => auth(userId ?? users.owner);

  return {
    db,
    app,
    run,
    MISSING_ID: '0192f7e0-0bcd-7000-8000-000000000999',
    otherId: () => users.other,
    /** Moves the server clock to `minutes` after START. */
    at(minutes: number) {
      clock = new Date(START.getTime() + minutes * MINUTE);
    },
    start: (testId: string, userId?: string) =>
      request(app).post('/api/v1/attempts').set('Authorization', as(userId)).send({testId}),
    get: (id: string, userId?: string) => request(app).get(`/api/v1/attempts/${id}`).set('Authorization', as(userId)),
    save: (id: string, state: object, userId?: string) =>
      request(app).put(`/api/v1/attempts/${id}/state`).set('Authorization', as(userId)).send({state}),
    submit: (id: string, userId?: string) =>
      request(app).post(`/api/v1/attempts/${id}/submit`).set('Authorization', as(userId)),
    createTest: (title: string, visibility: 'private' | 'public' = 'private') =>
      createFixtureTest({ownerId: users.owner, title: `${title} ${run}`, run, visibility, audioFileId}),

    async setup() {
      const create = (role: string) =>
        db.user.create({data: {email: `attempts-${role}-${run}@linmaster.test`, passwordHash: 'x', displayName: role}});
      users.owner = (await create('owner')).id;
      users.other = (await create('other')).id;
      audioFileId = (await createFixtureAudio(users.owner, run)).id;
    },

    async teardown() {
      const ids = [users.owner, users.other].filter(id => id !== '');
      if (ids.length > 0) await db.user.deleteMany({where: {id: {in: ids}}});
      await db.$disconnect();
    },
  };
}
