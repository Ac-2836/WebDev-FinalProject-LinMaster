import {buildChecklist, type ImportFile, type PageLabels} from '@linmaster/shared';

import {AppError} from '../../core/app-error';
import type {Storage} from '../../core/storage';
import {readAudioDurationSec} from './audio-duration';
import type {ImportFileRecord, ImportRepository} from './imports.repository';

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

function toImportFile(record: ImportFileRecord, pages: PageLabels[] | null): ImportFile {
  const type = record.mimeType === PDF_MIME_TYPE ? 'pdf' : 'audio';
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
  };
}
