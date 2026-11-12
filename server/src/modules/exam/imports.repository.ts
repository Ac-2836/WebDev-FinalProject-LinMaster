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
};
