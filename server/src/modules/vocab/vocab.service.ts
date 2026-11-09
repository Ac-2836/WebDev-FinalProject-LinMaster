import type {ListVocabEntriesQuery, SaveVocabEntry, VocabEntry} from '@linmaster/shared';
import {AppError} from '../../core/app-error';
import type {VocabRepository} from './vocab.repository';
import {VocabDocumentNotFoundError} from './vocab.repository';

export function createVocabService(repository: VocabRepository) {
  return {
    async saveEntries(ownerId: string, entries: SaveVocabEntry[]) {
      try {
        const savedById = new Map<string, VocabEntry>();
        for (const entry of entries) {
          const saved = await repository.saveEntry(ownerId, entry);
          savedById.set(saved.id, saved);
        }
        return {entries: [...savedById.values()]};
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
