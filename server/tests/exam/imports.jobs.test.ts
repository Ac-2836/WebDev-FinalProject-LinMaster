import {mkdtemp, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {AppError} from '../../src/core/app-error';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {createLocalStorage} from '../../src/core/storage';
import {
  createExamModule,
  createImportJobs,
  type ImportJob,
  type ImportJobs,
  type ImportOutcome,
} from '../../src/modules/exam';
import {makeImportRepository} from './import-fakes';

const JWT_SECRET = 'imports-test-secret-that-is-at-least-32-characters';
const USER_ID = '0192f7e0-0bcd-7000-8000-000000000041';
const TEST_ID = '0192f7e0-0bcd-7000-8000-000000000777';
const PDF = Buffer.from('%PDF-1.4\n% LinMaster test file\n');
const HOUR = 60 * 60 * 1000;
const DONE: ImportOutcome = {
  status: 'done',
  testId: TEST_ID,
  issues: [{severity: 'warning', code: 'MISSING_TRANSCRIPT', message: 'No transcript.'}],
};

describe('test import jobs', () => {
  let directory: string;
  let state: ReturnType<typeof makeImportRepository>;
  let now: Date;
  let processed: ImportJob[];
  let process: (job: ImportJob) => Promise<ImportOutcome>;
  let jobs: ImportJobs;
  let app: express.Express;
  let storage: ReturnType<typeof createLocalStorage>;

  const auth = () => `Bearer ${signJwt(USER_ID, JWT_SECRET)}`;
  const getImport = (id: string) => request(app).get(`/api/v1/tests/imports/${id}`).set('Authorization', auth());
  const upload = (name: string) =>
    request(app)
      .post('/api/v1/tests/imports/files')
      .set('Authorization', auth())
      .attach('file', PDF, {filename: name, contentType: 'application/pdf'});
  /** A stored file created at `createdAt`, without the upload route (which would run the cleanup). */
  const fileAt = async (createdAt: Date) => {
    state.clock.fileCreatedAt = createdAt;
    const stored = await storage.put({data: PDF, mimeType: 'application/pdf', originalName: 'old.pdf'});
    const {key: storageKey, mimeType, sizeBytes, originalName} = stored;
    const file = await state.repository.createFile(USER_ID, {
      storageKey,
      mimeType,
      sizeBytes,
      originalName,
      durationSec: null,
    });
    state.clock.fileCreatedAt = now;
    return file;
  };
  const queuedImport = async (status: 'queued' | 'parsing' | 'validating' | 'done' = 'queued') => {
    const pdf = await state.repository.createFile(USER_ID, {
      storageKey: '0192f7e0-0bcd-7000-8000-00000000aaaa',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      originalName: 'test.pdf',
      durationSec: null,
    });
    const created = await state.repository.createImport(USER_ID, {
      kind: 'reading',
      pdf: {fileId: pdf.id},
      audioFileId: null,
    });
    state.imports.get(created.id)!.status = status;
    return created.id;
  };

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'linmaster-import-jobs-'));
    state = makeImportRepository();
    now = new Date('2026-11-13T04:00:00.000Z');
    processed = [];
    process = async () => DONE;
    storage = createLocalStorage({directory});
    jobs = createImportJobs({
      repository: state.repository,
      storage,
      process: async (job, progress) => {
        processed.push(job);
        expect(state.imports.get(job.id)!.status).toBe('parsing');
        await progress.validating();
        expect(state.imports.get(job.id)!.status).toBe('validating');
        return process(job);
      },
      now: () => now,
    });
    app = express();
    app.use(express.json());
    app.use(
      '/api/v1',
      createExamModule(JWT_SECRET, {repository: state.repository, storage, jobs, labelPages: async () => []}).router,
    );
    app.use(errorMiddleware);
  });

  afterEach(async () => {
    await jobs.idle();
    await rm(directory, {recursive: true, force: true});
  });

  it('runs the job after POST /tests/imports and stores the test and its warnings', async () => {
    const {body} = await upload('reading.pdf');
    const created = await request(app)
      .post('/api/v1/tests/imports')
      .set('Authorization', auth())
      .send({kind: 'reading', files: [{fileId: body.file.id, slots: ['test', 'answers']}]});
    await jobs.idle();

    expect(processed).toEqual([
      expect.objectContaining({id: created.body.import.id, questionFileId: body.file.id, answerFileId: body.file.id}),
    ]);
    const response = await getImport(created.body.import.id);
    expect(response.body.import).toMatchObject({status: 'done', testId: TEST_ID, errors: DONE.issues});
    expect(response.body.import.finishedAt).not.toBeNull();
    expect(processed).toHaveLength(1);
  });

  it('fails the import with the message of an AppError, and a generic one otherwise', async () => {
    process = async () => {
      throw new AppError('AI unavailable.', 503);
    };
    const appErrorId = await queuedImport();
    await getImport(appErrorId);
    await jobs.idle();
    process = async () => {
      throw new Error('database password in a stack trace');
    };
    const crashId = await queuedImport();
    await getImport(crashId);
    await jobs.idle();

    expect((await getImport(appErrorId)).body.import).toMatchObject({
      status: 'failed',
      testId: null,
      errors: [{severity: 'error', code: 'IMPORT_JOB_FAILED', message: 'AI unavailable.'}],
    });
    const crash = (await getImport(crashId)).body.import;
    expect(crash.status).toBe('failed');
    expect(crash.errors[0].message).toBe('The files could not be read into a test.');
  });

  it('starts again an import left unfinished by a restart when the client polls', async () => {
    const parsingId = await queuedImport('parsing');
    const validatingId = await queuedImport('validating');

    await getImport(parsingId);
    await getImport(validatingId);
    await jobs.idle();

    expect(processed.map(job => job.id).sort()).toEqual([parsingId, validatingId].sort());
    expect(state.imports.get(parsingId)!.status).toBe('done');
  });

  it('runs one job per import however often the client polls, and never a finished import', async () => {
    let release!: () => void;
    process = () => new Promise(resolve => (release = () => resolve(DONE)));
    const id = await queuedImport();
    const doneId = await queuedImport('done');

    await getImport(id);
    await getImport(id);
    await getImport(doneId);
    await new Promise(resolve => setImmediate(resolve));
    release();
    await jobs.idle();
    await getImport(id);
    await jobs.idle();

    expect(processed.map(job => job.id)).toEqual([id]);
  });

  describe('orphan files', () => {
    it('deletes files no import uses after 24 hours, with their stored object', async () => {
      const old = await fileAt(new Date(now.getTime() - 25 * HOUR));
      const used = await fileAt(new Date(now.getTime() - 25 * HOUR));
      state.inUse.add(used.id);
      const recent = await fileAt(new Date(now.getTime() - 23 * HOUR));

      await upload('trigger.pdf');
      await jobs.idle();

      expect(state.files.has(old.id)).toBe(false);
      expect(state.files.has(used.id)).toBe(true);
      expect(state.files.has(recent.id)).toBe(true);
      const objects = await readdir(directory);
      expect(objects).not.toContain(old.storageKey);
      expect(objects).toContain(used.storageKey);
    });

    it('runs at most once an hour', async () => {
      await upload('first.pdf');
      await jobs.idle();
      const old = await fileAt(new Date(now.getTime() - 25 * HOUR));

      await upload('second.pdf');
      await jobs.idle();
      expect(state.files.has(old.id)).toBe(true);

      now = new Date(now.getTime() + HOUR);
      await upload('third.pdf');
      await jobs.idle();
      expect(state.files.has(old.id)).toBe(false);
    });
  });
});
