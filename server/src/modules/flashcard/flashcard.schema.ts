import {
  CreateFlashcardSetFromVocabSchema,
  CreateFlashcardSetSchema,
  FlashcardSetIdParamsSchema,
  ReplaceFlashcardCardsRequestSchema,
  UpdateFlashcardSetSchema,
} from '@linmaster/shared';
import {z} from 'zod';

export const createFlashcardSetSchema = z.object({body: CreateFlashcardSetSchema});
export const createFlashcardSetFromVocabSchema = z.object({body: CreateFlashcardSetFromVocabSchema});
export const listFlashcardSetsSchema = z.object({});
export const getFlashcardSetSchema = z.object({params: FlashcardSetIdParamsSchema});
export const updateFlashcardSetSchema = z.object({
  params: FlashcardSetIdParamsSchema,
  body: UpdateFlashcardSetSchema,
});
export const deleteFlashcardSetSchema = z.object({params: FlashcardSetIdParamsSchema});
export const replaceFlashcardCardsSchema = z.object({
  params: FlashcardSetIdParamsSchema,
  body: ReplaceFlashcardCardsRequestSchema,
});
