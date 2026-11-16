import type {
  CreateFlashcardSet,
  CreateFlashcardSetFromVocab,
  QuizQuery,
  QuizResponse,
  ReplaceFlashcardCardInput,
  UpdateFlashcardSet,
  VocabEntry,
} from '@linmaster/shared';
import {QUIZ_MIN_CARDS} from '@linmaster/shared';
import {AppError} from '../../core/app-error';
import {buildQuiz} from './quiz';
import type {FlashcardRepository} from './flashcard.repository';
import {FlashcardCardNotFoundError, FlashcardVocabEntryNotFoundError} from './flashcard.repository';

export interface VocabEntryProvider {
  getEntriesForUser(ownerId: string, ids: string[]): Promise<VocabEntry[]>;
}

export function createFlashcardService(repository: FlashcardRepository, vocabEntries: VocabEntryProvider) {
  return {
    async createSet(ownerId: string, input: CreateFlashcardSet) {
      return {set: await repository.createSet(ownerId, input)};
    },

    async createSetFromVocab(ownerId: string, input: CreateFlashcardSetFromVocab) {
      const entries = await vocabEntries.getEntriesForUser(ownerId, input.vocabIds);
      if (entries.length !== input.vocabIds.length) {
        throw new AppError('One or more vocabulary entries were not found.', 404);
      }

      const cards: ReplaceFlashcardCardInput[] = entries.map(entry => ({
        term: entry.headword,
        definition: entry.meaningVi,
        example: entry.contexts[0]?.sentence ?? null,
        vocabEntryId: entry.id,
      }));
      const setInput: CreateFlashcardSet = {
        title: input.title,
        description: input.description,
        termLang: input.termLang,
        definitionLang: input.definitionLang,
      };
      return {set: await repository.createSet(ownerId, setInput, cards)};
    },

    async listSets(ownerId: string) {
      const sets = await repository.listSets(ownerId);
      return {
        sets: sets.map(({_count, ...set}) => ({...set, cardCount: _count.cards})),
      };
    },

    async getSet(ownerId: string, id: string) {
      const set = await repository.findSet(ownerId, id);
      if (!set) throw new AppError('Flashcard set not found.', 404);
      return {set};
    },

    /** Owner or anyone for a public set; the quiz carries its answers, like the cards the reader already sees. */
    async getQuiz(userId: string, id: string, query: QuizQuery): Promise<QuizResponse> {
      const set = await repository.findReadableSet(userId, id);
      if (!set) throw new AppError('Flashcard set not found.', 404);
      if (set.cards.length < QUIZ_MIN_CARDS) {
        throw new AppError(`A quiz needs at least ${QUIZ_MIN_CARDS} cards in the set.`, 422);
      }
      return {setId: set.id, questions: buildQuiz(set.cards, query)};
    },

    async updateSet(ownerId: string, id: string, input: UpdateFlashcardSet) {
      const set = await repository.updateSet(ownerId, id, input);
      if (!set) throw new AppError('Flashcard set not found.', 404);
      return {set};
    },

    async deleteSet(ownerId: string, id: string) {
      if (!(await repository.deleteSet(ownerId, id))) throw new AppError('Flashcard set not found.', 404);
      return {deleted: true as const};
    },

    async replaceCards(ownerId: string, setId: string, cards: ReplaceFlashcardCardInput[]) {
      try {
        const savedCards = await repository.replaceCards(ownerId, setId, cards);
        if (!savedCards) throw new AppError('Flashcard set not found.', 404);
        return {cards: savedCards};
      } catch (error) {
        if (error instanceof FlashcardCardNotFoundError) throw new AppError('Card not found in this set.', 404);
        if (error instanceof FlashcardVocabEntryNotFoundError) {
          throw new AppError('Vocabulary entry not found.', 404);
        }
        throw error;
      }
    },
  };
}
