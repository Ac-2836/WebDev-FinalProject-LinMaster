import {
  CreateFlashcardSetFromVocabSchema,
  CreateFlashcardSetSchema,
  EndStudySessionRequestSchema,
  FlashcardSetIdParamsSchema,
  GenerateExerciseRequestSchema,
  QuizQuerySchema,
  ReplaceFlashcardCardsRequestSchema,
  ReviewCardRequestSchema,
  StartStudySessionRequestSchema,
  StudySessionIdParamsSchema,
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
export const getStudyCardsSchema = z.object({params: FlashcardSetIdParamsSchema});
export const reviewCardSchema = z.object({body: ReviewCardRequestSchema});
export const startStudySessionSchema = z.object({body: StartStudySessionRequestSchema});
export const endStudySessionSchema = z.object({params: StudySessionIdParamsSchema, body: EndStudySessionRequestSchema});
export const dueSummarySchema = z.object({});
export const getQuizSchema = z.object({params: FlashcardSetIdParamsSchema, query: QuizQuerySchema});
export const generateExerciseSchema = z.object({
  params: FlashcardSetIdParamsSchema,
  body: GenerateExerciseRequestSchema,
});
