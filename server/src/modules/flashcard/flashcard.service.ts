import type {
  CreateFlashcardSet,
  CreateFlashcardSetFromVocab,
  GenerateExerciseRequest,
  GenerateExerciseResponse,
  GeneratedExercise,
  QuizQuery,
  QuizResponse,
  ReplaceFlashcardCardInput,
  UpdateFlashcardSet,
  VocabEntry,
} from '@linmaster/shared';
import {EXERCISE_MAX_CARDS, EXERCISE_MIN_CARDS, QUIZ_MIN_CARDS} from '@linmaster/shared';
import {AppError} from '../../core/app-error';
import {createHash} from 'node:crypto';

import {buildExercise, enough, type ExerciseCard, exerciseSize} from './exercise';
import {buildQuiz} from './quiz';
import type {FlashcardRepository} from './flashcard.repository';
import {FlashcardCardNotFoundError, FlashcardVocabEntryNotFoundError} from './flashcard.repository';

export interface VocabEntryProvider {
  getEntriesForUser(ownerId: string, ids: string[]): Promise<VocabEntry[]>;
}

/** Runs `generate-exercise.v1`. */
export type ExerciseGenerator = (
  input: {cards: ExerciseCard[]; kinds: GenerateExerciseRequest['kinds']; count: number},
  userId: string,
) => Promise<GeneratedExercise>;

/**
 * A practice request that just failed (the model never gave enough valid questions) fails again at once for this
 * long, so pressing the button again does not spend three more Gemini calls.
 */
export const EXERCISE_FAILURE_COOLDOWN_MS = 60_000;
const MAX_REMEMBERED_FAILURES = 500;

export function createFlashcardService(
  repository: FlashcardRepository,
  vocabEntries: VocabEntryProvider,
  generateExercise: ExerciseGenerator,
  nowMs: () => number = Date.now,
) {
  // shortcut: kept in this process, so a restart or a second server instance forgets it; move to the AiCache table if
  // that matters.
  const failedExercises = new Map<string, number>();
  const invalidOutput = () =>
    new AppError('AI trả về kết quả không hợp lệ, hãy thử lại sau ít phút.', 502, undefined, 'AI_INVALID_OUTPUT');

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

    /**
     * Owner only (it spends AI quota): AI practice questions that use only the terms of the set. Questions that fail
     * the checks are dropped; fewer than half of those asked for is an error. Nothing is stored.
     */
    async generateExercise(
      userId: string,
      id: string,
      request: GenerateExerciseRequest,
    ): Promise<GenerateExerciseResponse> {
      const set = await repository.findSet(userId, id);
      if (!set) throw new AppError('Flashcard set not found.', 404);
      if (set.cards.length < EXERCISE_MIN_CARDS) {
        throw new AppError(`Practice needs at least ${EXERCISE_MIN_CARDS} cards in the set.`, 422);
      }
      const cards = set.cards.slice(0, EXERCISE_MAX_CARDS).map(({id, term, definition}) => ({id, term, definition}));
      const key = createHash('sha256')
        .update(JSON.stringify([userId, [...request.kinds].sort(), request.count, cards]))
        .digest('hex');
      if ((failedExercises.get(key) ?? 0) > nowMs()) throw invalidOutput();

      const failed = () => {
        if (failedExercises.size >= MAX_REMEMBERED_FAILURES) failedExercises.clear();
        failedExercises.set(key, nowMs() + EXERCISE_FAILURE_COOLDOWN_MS);
        return invalidOutput();
      };
      let questions;
      try {
        questions = buildExercise(await generateExercise({cards, ...request}, userId), cards, request);
      } catch (error) {
        throw error instanceof AppError && error.status === 'AI_INVALID_OUTPUT' ? failed() : error;
      }
      if (!enough(exerciseSize(questions), request.count, cards.length)) throw failed();
      return {setId: set.id, questions};
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
