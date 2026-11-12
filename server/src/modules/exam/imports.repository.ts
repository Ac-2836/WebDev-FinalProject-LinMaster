import type {ImportIssue, ImportStatus, TestKind} from '@linmaster/shared';

import {getDb} from '../../core/db';

/** A row of `StoredFile` uploaded for a test import. */
export interface ImportFileRecord {
  id: string;
  ownerId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  durationSec: number | null;
  createdAt: Date;
}

export interface NewImportFile {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  durationSec: number | null;
}

/** A stored file looked up for a new import. `inUse` when an import or a test already points at it. */
export interface ImportFileUse extends ImportFileRecord {
  inUse: boolean;
}

/** A row of `TestImport`. `errors` is the raw jsonb column. */
export interface ImportRecord {
  id: string;
  ownerId: string;
  kind: TestKind;
  status: ImportStatus;
  errors: unknown;
  testId: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface NewImport {
  kind: TestKind;
  /** The only PDF of the import, or a PDF merged from several that is stored together with the import. */
  pdf: {fileId: string} | {merged: NewImportFile};
  audioFileId: string | null;
}

/** What the background job reads: the import and the files it points at. */
export interface ImportJob {
  id: string;
  ownerId: string;
  kind: TestKind;
  /** The same PDF as the answer file (PLAN C4 step 2). */
  questionFileId: string;
  answerFileId: string;
  audioFileId: string | null;
}

/** End of a job: `done` with the new test and its warnings, or `failed` with the blocking errors. */
export type ImportOutcome =
  {status: 'done'; testId: string; issues: ImportIssue[]} | {status: 'failed'; issues: ImportIssue[]};

const UNFINISHED: ImportStatus[] = ['queued', 'parsing', 'validating'];

export interface ImportRepository {
  createFile(ownerId: string, file: NewImportFile): Promise<ImportFileRecord>;
  /** The file when it belongs to the user, else null. */
  findFile(ownerId: string, fileId: string): Promise<ImportFileRecord | null>;
  /**
   * Deletes the file only while no import, test section or question group points at it. `in_use` otherwise.
   * The check is part of the delete itself: the audio and image foreign keys are ON DELETE SET NULL, so the
   * database alone would silently detach the audio from a test instead of refusing.
   */
  deleteFile(ownerId: string, fileId: string): Promise<'deleted' | 'missing' | 'in_use'>;
  /** The files of the user among `fileIds`; ids of other users or unknown ids are left out. */
  findFiles(ownerId: string, fileIds: string[]): Promise<ImportFileUse[]>;
  /** Creates a `queued` import whose question and answer file are the same PDF (PLAN C4 step 2). */
  createImport(ownerId: string, data: NewImport): Promise<ImportRecord>;
  /** The import when it belongs to the user, else null. */
  findImport(ownerId: string, importId: string): Promise<ImportRecord | null>;
  /**
   * Moves an unfinished import to `parsing` and returns it, or null when it is already `done` or `failed`.
   * An import left in `parsing` or `validating` by a stopped server is claimed again.
   */
  claimImport(importId: string): Promise<ImportJob | null>;
  setImportStatus(importId: string, status: 'validating'): Promise<void>;
  /** Stores the outcome, unless the import is already finished. */
  finishImport(importId: string, outcome: ImportOutcome): Promise<void>;
  /**
   * Deletes up to `limit` files created before `createdBefore` that nothing refers to, and returns their storage
   * keys so the caller removes the stored objects.
   */
  deleteOrphanFiles(createdBefore: Date, limit: number): Promise<string[]>;
}

/** No row of the exam module refers to the file. */
const UNUSED = {
  importQuestionFiles: {none: {}},
  importAnswerFiles: {none: {}},
  importAudioFiles: {none: {}},
  sectionAudios: {none: {}},
  groupImages: {none: {}},
} as const;

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export const prismaImportRepository: ImportRepository = {
  async createFile(ownerId, file) {
    return getDb().storedFile.create({data: {ownerId, ...file}});
  },

  async findFile(ownerId, fileId) {
    return getDb().storedFile.findFirst({where: {id: fileId, ownerId}});
  },

  async deleteFile(ownerId, fileId) {
    const db = getDb();
    try {
      const {count} = await db.storedFile.deleteMany({where: {id: fileId, ownerId, ...UNUSED}});
      if (count > 0) return 'deleted';
    } catch (error) {
      // An import created between the check and the delete still trips the RESTRICT keys.
      if (hasPrismaCode(error, 'P2003')) return 'in_use';
      throw error;
    }
    return (await db.storedFile.count({where: {id: fileId, ownerId}})) > 0 ? 'in_use' : 'missing';
  },

  async findFiles(ownerId, fileIds) {
    const db = getDb();
    const where = {id: {in: fileIds}, ownerId};
    const [files, unused] = await Promise.all([
      db.storedFile.findMany({where}),
      db.storedFile.findMany({where: {...where, ...UNUSED}, select: {id: true}}),
    ]);
    const unusedIds = new Set(unused.map(file => file.id));
    return files.map(file => ({...file, inUse: !unusedIds.has(file.id)}));
  },

  async createImport(ownerId, {kind, pdf, audioFileId}) {
    return getDb().$transaction(async tx => {
      const pdfFileId =
        'fileId' in pdf ? pdf.fileId : (await tx.storedFile.create({data: {ownerId, ...pdf.merged}})).id;
      return tx.testImport.create({
        data: {ownerId, kind, questionFileId: pdfFileId, answerFileId: pdfFileId, audioFileId},
      });
    });
  },

  async findImport(ownerId, importId) {
    return getDb().testImport.findFirst({where: {id: importId, ownerId}});
  },

  async claimImport(importId) {
    const db = getDb();
    const {count} = await db.testImport.updateMany({
      where: {id: importId, status: {in: UNFINISHED}},
      data: {status: 'parsing'},
    });
    if (count === 0) return null;
    return db.testImport.findUnique({
      where: {id: importId},
      select: {id: true, ownerId: true, kind: true, questionFileId: true, answerFileId: true, audioFileId: true},
    });
  },

  async setImportStatus(importId, status) {
    await getDb().testImport.updateMany({where: {id: importId, status: {in: UNFINISHED}}, data: {status}});
  },

  async finishImport(importId, outcome) {
    await getDb().testImport.updateMany({
      where: {id: importId, status: {in: UNFINISHED}},
      data: {
        status: outcome.status,
        errors: outcome.issues,
        testId: outcome.status === 'done' ? outcome.testId : null,
        finishedAt: new Date(),
      },
    });
  },

  async deleteOrphanFiles(createdBefore, limit) {
    const db = getDb();
    const orphans = await db.storedFile.findMany({
      where: {createdAt: {lt: createdBefore}, ...UNUSED},
      select: {id: true, storageKey: true},
      orderBy: {createdAt: 'asc'},
      take: limit,
    });
    if (orphans.length === 0) return [];
    const ids = orphans.map(file => file.id);
    try {
      // The references are checked again: an import may have taken a file since the first query.
      await db.storedFile.deleteMany({where: {id: {in: ids}, ...UNUSED}});
    } catch (error) {
      if (hasPrismaCode(error, 'P2003')) return [];
      throw error;
    }
    const kept = new Set((await db.storedFile.findMany({where: {id: {in: ids}}, select: {id: true}})).map(f => f.id));
    return orphans.filter(file => !kept.has(file.id)).map(file => file.storageKey);
  },
};
