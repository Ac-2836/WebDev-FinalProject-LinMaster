import {mkdtemp, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {ApiErrorBody, type PageLabels, UploadImportFileResponseSchema} from '@linmaster/shared';
import {AppError} from '../../src/core/app-error';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {createLocalStorage} from '../../src/core/storage';
import {createExamModule, type PageLabeler} from '../../src/modules/exam';
import type {ImportFileRecord, ImportRepository} from '../../src/modules/exam/imports.repository';
import {cbrMp3, m4a} from './audio-fixtures';

const JWT_SECRET = 'imports-test-secret-that-is-at-least-32-characters';
const USER_ID = '0192f7e0-0bcd-7000-8000-000000000041';
const OTHER_USER_ID = '0192f7e0-0bcd-7000-8000-000000000042';
const PDF = Buffer.from('%PDF-1.4\n% LinMaster test file\n');

const READING_PAGES: PageLabels[] = [
  {page: 1, labels: ['passage', 'questions'], skill: 'reading', questionRange: {from: 1, to: 13}},
  {page: 2, labels: ['answers'], skill: 'reading', questionRange: {from: 1, to: 40}},
];

function makeRepository() {
  const files = new Map<string, ImportFileRecord>();
  const inUse = new Set<string>();
  let next = 0;
  const repository: ImportRepository = {
    async createFile(ownerId, file) {
      next += 1;
      const id = `0192f7e0-0bcd-7000-8000-${String(100 + next).padStart(12, '0')}`;
      const record = {id, ownerId, ...file, createdAt: new Date('2026-11-13T03:00:00.000Z')};
      files.set(id, record);
      return record;
    },
    async findFile(ownerId, fileId) {
      const file = files.get(fileId);
      return file && file.ownerId === ownerId ? file : null;
    },
    async deleteFile(ownerId, fileId) {
      const file = files.get(fileId);
      if (!file || file.ownerId !== ownerId) return 'missing';
      if (inUse.has(fileId)) return 'in_use';
      files.delete(fileId);
      return 'deleted';
    },
  };
  return {repository, files, inUse};
}

describe('test import files API', () => {
  let directory: string;
  let state: ReturnType<typeof makeRepository>;
  let labelCalls: {size: number; userId: string}[];
  let labelPages: PageLabeler;
  let app: express.Express;

  const auth = (userId = USER_ID) => `Bearer ${signJwt(userId, JWT_SECRET)}`;
  const storedObjects = async () => readdir(directory).catch(() => []);
  const upload = (data: Buffer, filename: string, contentType: string, userId = USER_ID) =>
    request(app)
      .post('/api/v1/tests/imports/files')
      .set('Authorization', auth(userId))
      .attach('file', data, {filename, contentType});

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'linmaster-imports-'));
    state = makeRepository();
    labelCalls = [];
    labelPages = async (pdf, {userId}) => {
      labelCalls.push({size: pdf.length, userId});
      return READING_PAGES;
    };
    app = express();
    app.use(
      '/api/v1',
      createExamModule(JWT_SECRET, {
        repository: state.repository,
        storage: createLocalStorage({directory}),
        labelPages: (pdf, context) => labelPages(pdf, context),
      }).router,
    );
    app.use(errorMiddleware);
  });

  afterEach(async () => {
    await rm(directory, {recursive: true, force: true});
  });

  it('stores a PDF with the labels of every page', async () => {
    const response = await upload(PDF, 'reading.pdf', 'application/pdf');

    expect(response.status).toBe(201);
    const {file} = UploadImportFileResponseSchema.parse(response.body);
    expect(file).toMatchObject({
      originalName: 'reading.pdf',
      mimeType: 'application/pdf',
      type: 'pdf',
      pageCount: 2,
      durationSec: null,
      pages: READING_PAGES,
      unused: false,
    });
    expect(labelCalls).toEqual([{size: PDF.length, userId: USER_ID}]);
    expect(await storedObjects()).toHaveLength(1);
    expect(state.files.get(file.id)?.ownerId).toBe(USER_ID);
  });

  it('marks a PDF with no test content as unused', async () => {
    labelPages = async () => [{page: 1, labels: ['other'], skill: null, questionRange: null}];

    const response = await upload(PDF, 'menu.pdf', 'application/pdf');

    expect(response.status).toBe(201);
    expect(response.body.file).toMatchObject({unused: true, pageCount: 1});
  });

  it('keeps the PDF without labels when the AI is unavailable or out of quota', async () => {
    for (const status of [429, 502, 503]) {
      labelPages = async () => {
        throw new AppError('AI down.', status);
      };
      const response = await upload(PDF, 'reading.pdf', 'application/pdf');

      expect(response.status, String(status)).toBe(201);
      expect(response.body.file).toMatchObject({pages: null, pageCount: null, unused: false});
    }
  });

  it('rejects an unreadable PDF and removes the stored object', async () => {
    labelPages = async () => {
      throw new AppError('The uploaded file is not a readable PDF.', 400);
    };

    const response = await upload(PDF, 'broken.pdf', 'application/pdf');

    expect(response.status).toBe(400);
    expect(await storedObjects()).toEqual([]);
    expect(state.files.size).toBe(0);
  });

  it('stores MP3 and M4A audio with their length and no AI call', async () => {
    const mp3 = await upload(cbrMp3(30), 'part1.mp3', 'audio/mpeg');
    const audio = await upload(m4a(1800), 'listening.m4a', 'audio/x-m4a');

    expect(mp3.status).toBe(201);
    expect(mp3.body.file).toMatchObject({type: 'audio', durationSec: 30, pages: null, pageCount: null});
    expect(audio.status).toBe(201);
    expect(audio.body.file).toMatchObject({type: 'audio', mimeType: 'audio/mp4', durationSec: 1800});
    expect(labelCalls).toEqual([]);
  });

  it('accepts valid files whatever generic or alias type the browser declares', async () => {
    const responses = [
      await upload(cbrMp3(30), 'part1.mp3', 'audio/mp3'),
      await upload(cbrMp3(30), 'part1.mp3', 'application/octet-stream'),
      await upload(m4a(1800), 'listening.m4a', 'application/octet-stream'),
      await upload(PDF, 'test.pdf', 'application/octet-stream'),
    ];

    for (const response of responses) expect(response.status).toBe(201);
    expect(responses[0].body.file).toMatchObject({type: 'audio', mimeType: 'audio/mpeg', durationSec: 30});
    expect(responses[1].body.file).toMatchObject({type: 'audio', mimeType: 'audio/mpeg', durationSec: 30});
    expect(responses[2].body.file).toMatchObject({type: 'audio', mimeType: 'audio/mp4', durationSec: 1800});
    expect(responses[3].body.file).toMatchObject({type: 'pdf', mimeType: 'application/pdf'});
  });

  it('accepts a file part sent without a Content-Type', async () => {
    const boundary = 'linmaster-no-type';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="part1"\r\n\r\n`),
      cbrMp3(30),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const response = await request(app)
      .post('/api/v1/tests/imports/files')
      .set('Authorization', auth())
      .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body.file).toMatchObject({type: 'audio', mimeType: 'audio/mpeg', durationSec: 30});
  });

  it('rejects audio whose length cannot be read and removes the stored object', async () => {
    const silentTag = Buffer.concat([Buffer.from('ID3\x04\0\0\0\0\0\0', 'latin1'), Buffer.alloc(100)]);

    const response = await upload(silentTag, 'broken.mp3', 'audio/mpeg');

    expect(response.status).toBe(400);
    expect(await storedObjects()).toEqual([]);
  });

  it('checks the type from the content, not the name or the declared type', async () => {
    const text = await upload(Buffer.from('not a test'), 'notes.txt', 'text/plain');
    const renamed = await upload(Buffer.from('not a pdf'), 'fake.pdf', 'application/pdf');
    const mismatch = await upload(PDF, 'test.mp3', 'audio/mpeg');

    for (const response of [text, renamed, mismatch]) {
      expect(response.status).toBe(415);
      expect(ApiErrorBody.safeParse(response.body).success).toBe(true);
    }
    expect(await storedObjects()).toEqual([]);
  });

  it('rejects a PDF over 20 MB', async () => {
    const large = Buffer.concat([PDF, Buffer.alloc(20 * 1024 * 1024)]);

    const response = await upload(large, 'large.pdf', 'application/pdf');

    expect(response.status).toBe(413);
    expect(labelCalls).toEqual([]);
  });

  it('needs a signed-in user and exactly one multipart file', async () => {
    const anonymous = await request(app).post('/api/v1/tests/imports/files').attach('file', PDF, 'a.pdf');
    const json = await request(app).post('/api/v1/tests/imports/files').set('Authorization', auth()).send({file: 'x'});
    const empty = await request(app)
      .post('/api/v1/tests/imports/files')
      .set('Authorization', auth())
      .field('name', 'x');
    const twoFiles = await request(app)
      .post('/api/v1/tests/imports/files')
      .set('Authorization', auth())
      .attach('file', PDF, 'a.pdf')
      .attach('file', PDF, 'b.pdf');

    expect(anonymous.status).toBe(401);
    expect(json.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(twoFiles.status).toBe(400);
    expect(await storedObjects()).toEqual([]);
  });

  describe('DELETE /tests/imports/files/:fileId', () => {
    it('deletes the row and the stored object', async () => {
      const {body} = await upload(PDF, 'reading.pdf', 'application/pdf');

      const response = await request(app)
        .delete(`/api/v1/tests/imports/files/${body.file.id}`)
        .set('Authorization', auth());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({deleted: true});
      expect(state.files.size).toBe(0);
      expect(await storedObjects()).toEqual([]);
    });

    it('answers 404 for a file of another user, and keeps it', async () => {
      const {body} = await upload(PDF, 'reading.pdf', 'application/pdf', OTHER_USER_ID);

      const response = await request(app)
        .delete(`/api/v1/tests/imports/files/${body.file.id}`)
        .set('Authorization', auth());

      expect(response.status).toBe(404);
      expect(state.files.has(body.file.id)).toBe(true);
      expect(await storedObjects()).toHaveLength(1);
    });

    it('answers 409 IMPORT_FILE_IN_USE when an import uses the file', async () => {
      const {body} = await upload(PDF, 'reading.pdf', 'application/pdf');
      state.inUse.add(body.file.id);

      const response = await request(app)
        .delete(`/api/v1/tests/imports/files/${body.file.id}`)
        .set('Authorization', auth());

      expect(response.status).toBe(409);
      expect(response.body.error.status).toBe('IMPORT_FILE_IN_USE');
      expect(await storedObjects()).toHaveLength(1);
    });

    it('validates the id and needs a signed-in user', async () => {
      const invalid = await request(app).delete('/api/v1/tests/imports/files/not-a-uuid').set('Authorization', auth());
      const anonymous = await request(app).delete(`/api/v1/tests/imports/files/${USER_ID}`);

      expect(invalid.status).toBe(400);
      expect(anonymous.status).toBe(401);
    });
  });
});
