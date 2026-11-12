import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {PDFDocument} from 'pdf-lib';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  ApiErrorBody,
  CreateImportResponseSchema,
  GetImportResponseSchema,
  ImportIncompleteDetailsSchema,
  type PageLabels,
} from '@linmaster/shared';
import {AppError} from '../../src/core/app-error';
import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {createLocalStorage} from '../../src/core/storage';
import {createExamModule} from '../../src/modules/exam';
import {cbrMp3} from './audio-fixtures';
import {makeImportRepository} from './import-fakes';

const JWT_SECRET = 'imports-test-secret-that-is-at-least-32-characters';
const USER_ID = '0192f7e0-0bcd-7000-8000-000000000041';
const OTHER_USER_ID = '0192f7e0-0bcd-7000-8000-000000000042';
const MISSING_ID = '0192f7e0-0bcd-7000-8000-000000000999';

const page = (labels: PageLabels['labels'], from?: number, to?: number): Omit<PageLabels, 'page'> => ({
  labels,
  skill: labels.includes('other') ? null : 'reading',
  questionRange: from ? {from, to: to ?? from} : null,
});
const numbered = (pages: Omit<PageLabels, 'page'>[]): PageLabels[] =>
  pages.map((p, index) => ({page: index + 1, ...p}));

/** A real PDF with `pages` blank pages; `marker` makes the bytes of each fixture different. */
async function makePdf(pages: number, marker: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(marker);
  for (let index = 0; index < pages; index++) doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

describe('test imports API', () => {
  let directory: string;
  let state: ReturnType<typeof makeImportRepository>;
  let storage: ReturnType<typeof createLocalStorage>;
  let labels: {pdf: Buffer; pages: PageLabels[]}[];
  let labelCalls: number;
  let aiDown: boolean;
  let app: express.Express;

  const auth = (userId = USER_ID) => `Bearer ${signJwt(userId, JWT_SECRET)}`;
  const upload = async (data: Buffer, filename: string, contentType: string, userId = USER_ID): Promise<string> => {
    const response = await request(app)
      .post('/api/v1/tests/imports/files')
      .set('Authorization', auth(userId))
      .attach('file', data, {filename, contentType});
    expect(response.status).toBe(201);
    return response.body.file.id;
  };
  const uploadPdf = async (pages: number, marker: string, pageLabels?: PageLabels[], userId = USER_ID) => {
    const pdf = await makePdf(pages, marker);
    if (pageLabels) labels.push({pdf, pages: pageLabels});
    return upload(pdf, `${marker}.pdf`, 'application/pdf', userId);
  };
  const createImport = (body: object, userId = USER_ID) =>
    request(app).post('/api/v1/tests/imports').set('Authorization', auth(userId)).send(body);
  const pageCountOf = async (fileId: string) => {
    const data = await storage.get(state.files.get(fileId)!.storageKey);
    return (await PDFDocument.load(data!)).getPageCount();
  };

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'linmaster-imports-create-'));
    state = makeImportRepository();
    storage = createLocalStorage({directory});
    labels = [];
    aiDown = false;
    labelCalls = 0;
    app = express();
    app.use(express.json());
    app.use(
      '/api/v1',
      createExamModule(JWT_SECRET, {
        repository: state.repository,
        storage,
        labelPages: async pdf => {
          labelCalls += 1;
          if (aiDown) throw new AppError('AI unavailable.', 503, undefined, 'AI_UNAVAILABLE');
          return labels.find(entry => entry.pdf.equals(pdf))?.pages ?? numbered([page(['other'])]);
        },
      }).router,
    );
    app.use(errorMiddleware);
  });

  afterEach(async () => {
    await rm(directory, {recursive: true, force: true});
  });

  it('queues a "Theo mẫu" import of one PDF in two boxes without calling the AI', async () => {
    const pdfId = await uploadPdf(3, 'reading-with-key');
    labelCalls = 0;

    const response = await createImport({kind: 'reading', files: [{fileId: pdfId, slots: ['test', 'answers']}]});

    expect(response.status).toBe(202);
    expect(CreateImportResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.import).toMatchObject({kind: 'reading', status: 'queued', errors: [], testId: null});
    expect(labelCalls).toBe(0);
    const row = state.imports.get(response.body.import.id)!;
    expect(row).toMatchObject({questionFileId: pdfId, audioFileId: null});
  });

  it('merges the PDFs of a Listening set in order and keeps the audio', async () => {
    const testId = await uploadPdf(2, 'listening-test');
    const answersId = await uploadPdf(1, 'listening-answers');
    const audioId = await upload(cbrMp3(30), 'audio.mp3', 'audio/mpeg');
    const filesBefore = state.files.size;
    labelCalls = 0;

    const response = await createImport({
      kind: 'listening',
      files: [
        {fileId: testId, slots: ['test']},
        {fileId: audioId, slots: ['audio']},
        {fileId: answersId, slots: ['answers']},
      ],
    });

    expect(response.status).toBe(202);
    expect(labelCalls).toBe(0);
    const row = state.imports.get(response.body.import.id)!;
    expect(row.audioFileId).toBe(audioId);
    expect(state.files.size).toBe(filesBefore + 1);
    expect(state.files.get(row.questionFileId)).toMatchObject({mimeType: 'application/pdf', ownerId: USER_ID});
    expect(await pageCountOf(row.questionFileId)).toBe(3);
  });

  it('labels the PDFs of the "AI nhận diện" tab and leaves an unused PDF out of the merge', async () => {
    const testId = await uploadPdf(2, 'ai-test', numbered([page(['passage', 'questions'], 1, 40), page(['passage'])]));
    const answersId = await uploadPdf(1, 'ai-answers', numbered([page(['answers'], 1, 40)]));
    const menuId = await uploadPdf(4, 'menu');
    labelCalls = 0;

    const response = await createImport({
      kind: 'reading',
      files: [{fileId: testId}, {fileId: menuId}, {fileId: answersId}],
    });

    expect(response.status).toBe(202);
    expect(labelCalls).toBe(3);
    expect(await pageCountOf(state.imports.get(response.body.import.id)!.questionFileId)).toBe(3);
  });

  it('answers 422 IMPORT_INCOMPLETE with the checklist when a required part is missing', async () => {
    const testId = await uploadPdf(2, 'only-test');
    const filesBefore = state.files.size;

    const response = await createImport({kind: 'reading', files: [{fileId: testId, slots: ['test']}]});

    expect(response.status).toBe(422);
    expect(response.body.error.status).toBe('IMPORT_INCOMPLETE');
    const details = ImportIncompleteDetailsSchema.parse(response.body.error.details);
    expect(details.checklist.complete).toBe(false);
    expect(details.checklist.items).toContainEqual(expect.objectContaining({part: 'answers', status: 'missing'}));
    expect(state.imports.size).toBe(0);
    expect(state.files.size).toBe(filesBefore);
  });

  it('answers 400 when a box does not fit the file type, before any AI call', async () => {
    const pdfId = await uploadPdf(1, 'box-test');
    const audioId = await upload(cbrMp3(30), 'audio.mp3', 'audio/mpeg');
    labelCalls = 0;

    const audioInTest = await createImport({
      kind: 'listening',
      files: [
        {fileId: pdfId, slots: ['answers']},
        {fileId: audioId, slots: ['test']},
      ],
    });
    const pdfInAudio = await createImport({kind: 'listening', files: [{fileId: pdfId, slots: ['test', 'audio']}]});

    for (const response of [audioInTest, pdfInAudio]) {
      expect(response.status).toBe(400);
      expect(ApiErrorBody.safeParse(response.body).success).toBe(true);
    }
    expect(labelCalls).toBe(0);
    expect(state.imports.size).toBe(0);
  });

  it('answers 400 for two audio files in one Listening test', async () => {
    const pdfId = await uploadPdf(1, 'two-audio');
    const first = await upload(cbrMp3(30), 'part1.mp3', 'audio/mpeg');
    const second = await upload(cbrMp3(31), 'part2.mp3', 'audio/mpeg');

    const response = await createImport({
      kind: 'listening',
      files: [
        {fileId: pdfId, slots: ['test', 'answers']},
        {fileId: first, slots: ['audio']},
        {fileId: second, slots: ['audio']},
      ],
    });

    expect(response.status).toBe(400);
  });

  it('answers 404 for a file of another user and 409 for a file another import uses', async () => {
    const foreignId = await uploadPdf(1, 'foreign', undefined, OTHER_USER_ID);
    const pdfId = await uploadPdf(1, 'reused');
    const body = {kind: 'reading', files: [{fileId: pdfId, slots: ['test', 'answers']}]};
    expect((await createImport(body)).status).toBe(202);

    const foreign = await createImport({kind: 'reading', files: [{fileId: foreignId, slots: ['test', 'answers']}]});
    const missing = await createImport({kind: 'reading', files: [{fileId: MISSING_ID, slots: ['test', 'answers']}]});
    const reused = await createImport(body);

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(reused.status).toBe(409);
    expect(reused.body.error.status).toBe('IMPORT_FILE_IN_USE');
    expect(state.imports.size).toBe(1);
  });

  it('passes the AI error on for a PDF without a box', async () => {
    const pdfId = await uploadPdf(1, 'ai-down');
    aiDown = true;

    const response = await createImport({kind: 'reading', files: [{fileId: pdfId}]});

    expect(response.status).toBe(503);
    expect(state.imports.size).toBe(0);
  });

  it('validates the body and needs a signed-in user', async () => {
    const pdfId = await uploadPdf(1, 'validation');
    const duplicate = await createImport({kind: 'reading', files: [{fileId: pdfId}, {fileId: pdfId}]});
    const tooMany = await createImport({
      kind: 'reading',
      files: Array.from({length: 11}, (_, index) => ({
        fileId: `0192f7e0-0bcd-7000-8000-${String(index).padStart(12, '0')}`,
      })),
    });
    const anonymous = await request(app)
      .post('/api/v1/tests/imports')
      .send({kind: 'reading', files: [{fileId: pdfId}]});

    expect(duplicate.status).toBe(400);
    expect(tooMany.status).toBe(400);
    expect(anonymous.status).toBe(401);
  });

  describe('GET /tests/imports/:id', () => {
    it('returns the import to its owner only', async () => {
      const pdfId = await uploadPdf(1, 'get');
      const created = await createImport({kind: 'reading', files: [{fileId: pdfId, slots: ['test', 'answers']}]});
      const url = `/api/v1/tests/imports/${created.body.import.id}`;

      const own = await request(app).get(url).set('Authorization', auth());
      const other = await request(app).get(url).set('Authorization', auth(OTHER_USER_ID));
      const invalid = await request(app).get('/api/v1/tests/imports/not-a-uuid').set('Authorization', auth());
      const anonymous = await request(app).get(url);

      expect(own.status).toBe(200);
      expect(GetImportResponseSchema.safeParse(own.body).success).toBe(true);
      expect(own.body).toEqual(created.body);
      expect(other.status).toBe(404);
      expect(invalid.status).toBe(400);
      expect(anonymous.status).toBe(401);
    });
  });
});
