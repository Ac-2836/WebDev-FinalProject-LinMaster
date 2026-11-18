import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {PDFDocument} from 'pdf-lib';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  ImportFileTextResponseSchema,
  MAX_IMPORT_TEXT_PAGE_CHARS,
  MAX_IMPORT_TEXT_PAGES,
  type PageLabels,
} from '@linmaster/shared';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {createLocalStorage} from '../../src/core/storage';
import {createExamModule, createImportJobs, type ImportJobs} from '../../src/modules/exam';
import {cbrMp3} from './audio-fixtures';
import {makeImportRepository} from './import-fakes';

const JWT_SECRET = 'imports-test-secret-that-is-at-least-32-characters';
const USER_ID = '0192f7e0-0bcd-7000-8000-000000000041';
const OTHER_USER_ID = '0192f7e0-0bcd-7000-8000-000000000042';
const MISSING_ID = '0192f7e0-0bcd-7000-8000-000000000999';

const LABELS: PageLabels[] = [
  {page: 1, labels: ['instructions', 'passage', 'questions'], skill: 'reading', questionRange: {from: 1, to: 40}},
  {page: 2, labels: ['answers'], skill: 'reading', questionRange: {from: 1, to: 40}},
];

/** A real PDF with `pages` blank pages; `marker` makes the bytes of each fixture different. */
async function makePdf(pages: number, marker: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(marker);
  for (let index = 0; index < pages; index++) doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

describe('PUT /api/v1/tests/imports/files/:fileId/text', () => {
  let directory: string;
  let state: ReturnType<typeof makeImportRepository>;
  let app: express.Express;
  let jobs: ImportJobs;

  const auth = (userId = USER_ID) => `Bearer ${signJwt(userId, JWT_SECRET)}`;
  const upload = async (data: Buffer, name: string, type = 'application/pdf'): Promise<string> => {
    const response = await request(app)
      .post('/api/v1/tests/imports/files')
      .set('Authorization', auth())
      .attach('file', data, {filename: name, contentType: type});
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body.file.id;
  };
  const putText = (fileId: string, body: unknown, userId = USER_ID) =>
    request(app)
      .put(`/api/v1/tests/imports/files/${fileId}/text`)
      .set('Authorization', auth(userId))
      .send(body as object);

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'linmaster-import-text-'));
    state = makeImportRepository();
    const storage = createLocalStorage({directory});
    jobs = createImportJobs({
      repository: state.repository,
      storage,
      process: async () => ({status: 'failed', issues: []}),
      now: () => new Date('2026-11-13T04:00:00.000Z'),
    });
    app = express();
    app.use(express.json({limit: '1mb'}));
    app.use(
      '/api/v1',
      createExamModule(JWT_SECRET, {
        repository: state.repository,
        storage,
        jobs,
        labelPages: async () => LABELS,
      }).router,
    );
    app.use(errorMiddleware);
  });

  afterEach(async () => {
    await jobs.idle();
    await rm(directory, {recursive: true, force: true});
  });

  it('stores the text page by page, lists the pages and replaces it on the next call', async () => {
    const fileId = await upload(await makePdf(2, 'a'), 'test.pdf');

    const first = await putText(fileId, {
      pages: [
        {page: 2, text: ''},
        {page: 1, text: 'READING PASSAGE 1'},
      ],
    });

    expect(first.status).toBe(200);
    const {file} = ImportFileTextResponseSchema.parse(first.body);
    expect(file).toMatchObject({id: fileId, textPages: [1, 2], pages: LABELS, pageCount: 2});
    expect(state.files.get(fileId)?.pageText).toEqual([
      {page: 1, text: 'READING PASSAGE 1'},
      {page: 2, text: ''},
    ]);

    const second = await putText(fileId, {pages: [{page: 1, text: 'New text'}]});
    expect(second.body.file.textPages).toEqual([1]);
    expect(state.files.get(fileId)?.pageText).toEqual([{page: 1, text: 'New text'}]);
  });

  it('keeps the files of other users private', async () => {
    const fileId = await upload(await makePdf(2, 'b'), 'test.pdf');

    expect((await putText(fileId, {pages: [{page: 1, text: 'x'}]}, OTHER_USER_ID)).status).toBe(404);
    expect((await putText(MISSING_ID, {pages: [{page: 1, text: 'x'}]})).status).toBe(404);
    expect(state.files.get(fileId)?.pageText).toBeNull();
    expect((await request(app).put(`/api/v1/tests/imports/files/${fileId}/text`).send({pages: []})).status).toBe(401);
  });

  it('refuses a page beyond the PDF, an audio file and a file an import already uses', async () => {
    const pdfId = await upload(await makePdf(2, 'c'), 'test.pdf');
    const audioId = await upload(cbrMp3(30), 'part1.mp3', 'audio/mpeg');

    expect((await putText(pdfId, {pages: [{page: 3, text: 'x'}]})).status).toBe(400);
    expect((await putText(audioId, {pages: [{page: 1, text: 'x'}]})).status).toBe(400);

    state.inUse.add(pdfId);
    const inUse = await putText(pdfId, {pages: [{page: 1, text: 'x'}]});
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.status).toBe('IMPORT_FILE_IN_USE');
  });

  it('validates the body: pages sent twice, too many, too long, too much text, unknown fields', async () => {
    const fileId = await upload(await makePdf(2, 'd'), 'test.pdf');
    const page = (number: number, text = 'x') => ({page: number, text});
    const bodies: unknown[] = [
      {pages: []},
      {pages: [page(1), page(1)]},
      {pages: [page(0)]},
      {pages: [page(1, 'x'.repeat(MAX_IMPORT_TEXT_PAGE_CHARS + 1))]},
      {pages: Array.from({length: MAX_IMPORT_TEXT_PAGES + 1}, (_, index) => page(index + 1))},
      {pages: Array.from({length: 60}, (_, index) => page(index + 1, 'x'.repeat(MAX_IMPORT_TEXT_PAGE_CHARS)))},
      {pages: [page(1)], extra: true},
      {pages: [{page: 1, text: 'x', extra: true}]},
    ];

    for (const body of bodies)
      expect((await putText(fileId, body)).status, JSON.stringify(body).slice(0, 80)).toBe(400);
    expect(state.files.get(fileId)?.pageText).toBeNull();
  });

  it('merges the text of several PDFs into the merged PDF, moving the pages of the later ones up', async () => {
    const first = await upload(await makePdf(2, 'e'), 'part-1.pdf');
    const second = await upload(await makePdf(2, 'f'), 'part-2.pdf');
    await putText(first, {
      pages: [
        {page: 1, text: 'first file, page 1'},
        {page: 2, text: 'first file, page 2'},
      ],
    });
    await putText(second, {pages: [{page: 1, text: 'second file, page 1'}]});

    const created = await request(app)
      .post('/api/v1/tests/imports')
      .set('Authorization', auth())
      .send({kind: 'reading', files: [{fileId: first}, {fileId: second}]});

    expect(created.status, JSON.stringify(created.body)).toBe(202);
    const merged = [...state.files.values()].find(file => file.originalName === 'merged-test.pdf');
    expect(merged?.pageText).toEqual([
      {page: 1, text: 'first file, page 1'},
      {page: 2, text: 'first file, page 2'},
      {page: 3, text: 'second file, page 1'},
    ]);
  });

  it('adds nothing to the merged PDF when no file has text', async () => {
    const first = await upload(await makePdf(2, 'g'), 'part-1.pdf');
    const second = await upload(await makePdf(2, 'h'), 'part-2.pdf');

    await request(app)
      .post('/api/v1/tests/imports')
      .set('Authorization', auth())
      .send({kind: 'reading', files: [{fileId: first}, {fileId: second}]});

    const merged = [...state.files.values()].find(file => file.originalName === 'merged-test.pdf');
    expect(merged?.pageText).toBeNull();
  });

  it('deletes the text with the file', async () => {
    const fileId = await upload(await makePdf(2, 'i'), 'test.pdf');
    await putText(fileId, {pages: [{page: 1, text: 'x'}]});

    const deleted = await request(app).delete(`/api/v1/tests/imports/files/${fileId}`).set('Authorization', auth());

    expect(deleted.status).toBe(200);
    expect(state.files.has(fileId)).toBe(false);
  });
});
