import {
  buildChecklist,
  type ChecklistFile,
  type CreateImportRequest,
  type ImportFile,
  type ImportFileType,
  ImportIssueSchema,
  type PageLabels,
  type TestImport,
} from '@linmaster/shared';
import {PDFDocument} from 'pdf-lib';
import {z} from 'zod';

import {AppError} from '../../core/app-error';
import type {Storage} from '../../core/storage';
import {readAudioDurationSec} from './audio-duration';
import type {
  ImportFileRecord,
  ImportFileUse,
  ImportRecord,
  ImportRepository,
  NewImportFile,
} from './imports.repository';

/** Labels every page of a PDF; the default is `classifyPages` of the exam AI tasks (KH, PLAN C4 step 1). */
export type PageLabeler = (pdf: Buffer, context: {userId: string}) => Promise<PageLabels[]>;

export interface ImportServiceDeps {
  repository: ImportRepository;
  storage: Storage;
  labelPages: PageLabeler;
}

export interface UploadedFile {
  data: Buffer;
  mimeType: string;
  originalName: string;
}

const PDF_MIME_TYPE = 'application/pdf';
const MERGED_PDF_NAME = 'merged-test.pdf';
const ImportIssuesSchema = z.array(ImportIssueSchema);

const fileTypeOf = (mimeType: string): ImportFileType => (mimeType === PDF_MIME_TYPE ? 'pdf' : 'audio');

function toImportFile(record: ImportFileRecord, pages: PageLabels[] | null): ImportFile {
  const type = fileTypeOf(record.mimeType);
  const unused =
    type === 'pdf' &&
    pages !== null &&
    buildChecklist({files: [{fileId: record.id, type, pages}]}).unusedFileIds.length > 0;
  return {
    id: record.id,
    originalName: record.originalName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    type,
    pageCount: pages?.length ?? null,
    durationSec: record.durationSec,
    pages,
    unused,
    createdAt: record.createdAt.toISOString(),
  };
}

function toTestImport(record: ImportRecord): TestImport {
  const errors = ImportIssuesSchema.safeParse(record.errors ?? []);
  return {
    id: record.id,
    kind: record.kind,
    status: record.status,
    errors: errors.success ? errors.data : [],
    testId: record.testId,
    createdAt: record.createdAt.toISOString(),
    finishedAt: record.finishedAt?.toISOString() ?? null,
  };
}

/** Appends every page of the PDFs, in order, into one PDF. */
async function mergePdfs(pdfs: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const pdf of pdfs) {
    let source: PDFDocument;
    try {
      source = await PDFDocument.load(pdf, {ignoreEncryption: true});
    } catch {
      throw new AppError('A PDF of the import could not be read.', 400);
    }
    for (const page of await merged.copyPages(source, source.getPageIndices())) merged.addPage(page);
  }
  return Buffer.from(await merged.save());
}

export function createImportService({repository, storage, labelPages}: ImportServiceDeps) {
  /**
   * When the AI is out of quota or unavailable the file is still kept without labels, so the "Theo mẫu" tab works.
   * An unreadable PDF (400) is rejected.
   */
  async function labelPdf(data: Buffer, userId: string): Promise<PageLabels[] | null> {
    try {
      return await labelPages(data, {userId});
    } catch (error) {
      if (error instanceof AppError && error.statusCode !== 400) return null;
      throw error;
    }
  }

  async function readFile(record: ImportFileRecord): Promise<Buffer> {
    const data = await storage.get(record.storageKey);
    if (!data) throw new AppError('Import file not found.', 404);
    return data;
  }

  /** The user's files of the request, in request order, after the checks that need no AI call. */
  async function loadFiles(userId: string, request: CreateImportRequest) {
    const records = new Map<string, ImportFileUse>();
    const found = await repository.findFiles(
      userId,
      request.files.map(file => file.fileId),
    );
    for (const record of found) records.set(record.id, record);
    return request.files.map(({fileId, slots}) => {
      const record = records.get(fileId);
      if (!record) throw new AppError('Import file not found.', 404);
      if (record.inUse) {
        throw new AppError('The file is used by a test import.', 409, undefined, 'IMPORT_FILE_IN_USE');
      }
      const type = fileTypeOf(record.mimeType);
      // Only an audio file fills the audio box, and an audio file fills no other box.
      const wrongSlots = slots?.filter(slot => (slot === 'audio') !== (type === 'audio')) ?? [];
      if (wrongSlots.length > 0) {
        throw new AppError(`"${record.originalName}" cannot fill the ${wrongSlots.join(', ')} box.`, 400);
      }
      return {record, type, slots};
    });
  }

  /** Stores the merged PDF; the caller removes it when the import is not created. */
  async function storeMergedPdf(pdfs: Buffer[]): Promise<{merged: NewImportFile}> {
    const data = await mergePdfs(pdfs);
    try {
      const {key, mimeType, sizeBytes, originalName} = await storage.put({
        data,
        mimeType: PDF_MIME_TYPE,
        originalName: MERGED_PDF_NAME,
      });
      return {merged: {storageKey: key, mimeType, sizeBytes, originalName, durationSec: null}};
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 413) {
        throw new AppError('The PDFs of the import together exceed 20 MB.', 413);
      }
      throw error;
    }
  }

  return {
    /** `POST /tests/imports/files`: stores one PDF or audio file and reads its page labels or length. */
    async uploadFile(userId: string, file: UploadedFile): Promise<{file: ImportFile}> {
      const stored = await storage.put(file);
      try {
        let pages: PageLabels[] | null = null;
        let durationSec: number | null = null;
        if (stored.mimeType === PDF_MIME_TYPE) {
          pages = await labelPdf(file.data, userId);
        } else {
          durationSec = readAudioDurationSec(file.data, stored.mimeType);
          if (durationSec === null) throw new AppError('The length of the audio file could not be read.', 400);
        }
        const record = await repository.createFile(userId, {
          storageKey: stored.key,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          originalName: stored.originalName,
          durationSec,
        });
        return {file: toImportFile(record, pages)};
      } catch (error) {
        await storage.delete(stored.key).catch(() => undefined);
        throw error;
      }
    },

    /** `DELETE /tests/imports/files/:fileId`: only the owner, and only while no import uses the file. */
    async deleteFile(userId: string, fileId: string): Promise<{deleted: true}> {
      const record = await repository.findFile(userId, fileId);
      if (!record) throw new AppError('Import file not found.', 404);

      const result = await repository.deleteFile(userId, fileId);
      if (result === 'in_use') {
        throw new AppError('The file is used by a test import.', 409, undefined, 'IMPORT_FILE_IN_USE');
      }
      if (result === 'missing') throw new AppError('Import file not found.', 404);
      await storage.delete(record.storageKey);
      return {deleted: true};
    },

    /**
     * `POST /tests/imports` (PLAN C4 step 2). Checks the files, rebuilds the "Độ đầy đủ" table (422 when a required
     * part is missing), merges the PDFs into one and creates a `queued` import. Files with a box ("Theo mẫu") need
     * no AI call; PDFs without one are labelled again, from the AI cache when their upload was labelled.
     */
    async createImport(userId: string, request: CreateImportRequest): Promise<{import: TestImport}> {
      const files = await loadFiles(userId, request);
      const pdfData = new Map<string, Buffer>();
      const checklistFiles: ChecklistFile[] = [];
      for (const {record, type, slots} of files) {
        let pages: PageLabels[] | null = null;
        if (type === 'pdf') {
          const data = await readFile(record);
          pdfData.set(record.id, data);
          if (!slots?.length) pages = await labelPages(data, {userId});
        }
        checklistFiles.push({fileId: record.id, type, pages, slots});
      }

      const checklist = buildChecklist({kind: request.kind, files: checklistFiles});
      if (!checklist.complete) {
        throw new AppError('Some required parts of the test are missing.', 422, {checklist}, 'IMPORT_INCOMPLETE');
      }
      const used = files.filter(file => !checklist.unusedFileIds.includes(file.record.id));
      const pdfIds = used.filter(file => file.type === 'pdf').map(file => file.record.id);
      const audios = used.filter(file => file.type === 'audio');
      if (audios.length > 1) throw new AppError('A test takes one audio file for the whole Listening section.', 400);
      if (pdfIds.length === 0) throw new AppError('The import needs at least one PDF.', 400);

      const pdf = pdfIds.length > 1 ? await storeMergedPdf(pdfIds.map(id => pdfData.get(id)!)) : {fileId: pdfIds[0]};
      try {
        const record = await repository.createImport(userId, {
          kind: request.kind,
          pdf,
          audioFileId: audios[0]?.record.id ?? null,
        });
        return {import: toTestImport(record)};
      } catch (error) {
        if ('merged' in pdf) await storage.delete(pdf.merged.storageKey).catch(() => undefined);
        throw error;
      }
    },

    /** `GET /tests/imports/:id`: status and issues of an import of the user. */
    async getImport(userId: string, importId: string): Promise<{import: TestImport}> {
      const record = await repository.findImport(userId, importId);
      if (!record) throw new AppError('Test import not found.', 404);
      return {import: toTestImport(record)};
    },
  };
}
