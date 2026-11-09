import type {ListVocabEntriesQuery, SaveVocabEntry} from '@linmaster/shared';
import {AppError} from '../../core/app-error';
import type {VocabRepository} from './vocab.repository';
import {VocabDocumentNotFoundError} from './vocab.repository';

export function createVocabService(repository: VocabRepository) {
  return {
    async saveEntries(ownerId: string, entries: SaveVocabEntry[]) {
      try {
        return {entries: await repository.saveEntries(ownerId, entries)};
      } catch (error) {
        if (error instanceof VocabDocumentNotFoundError) throw new AppError('Document not found.', 404);
        throw error;
      }
    },

    async listEntries(ownerId: string, query: ListVocabEntriesQuery) {
      const {entries, total} = await repository.listEntries(ownerId, query);
      return {
        entries,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      };
    },

    async getEntry(ownerId: string, id: string) {
      const entry = await repository.findEntry(ownerId, id);
      if (!entry) throw new AppError('Vocabulary entry not found.', 404);
      return {entry};
    },

    async updateNote(ownerId: string, id: string, note: string | null) {
      const entry = await repository.updateNote(ownerId, id, note);
      if (!entry) throw new AppError('Vocabulary entry not found.', 404);
      return {entry};
    },

    async deleteEntry(ownerId: string, id: string) {
      if (!(await repository.deleteEntry(ownerId, id))) throw new AppError('Vocabulary entry not found.', 404);
      return {deleted: true as const};
    },
  };
}
