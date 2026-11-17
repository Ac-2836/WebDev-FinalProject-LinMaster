import {z} from 'zod';

import {QUIZ_MIN_CARDS} from './quiz';

// AI practice from a flashcard set (PLAN C3, `generate-exercise.v1`, P4-11): exam-style questions that use only the
// terms of the set. Answers come with the questions, so the client grades at once.

/** A set needs this many cards, as for the quiz: the wrong options are other terms of the set. */
export const EXERCISE_MIN_CARDS = QUIZ_MIN_CARDS;
/** Cards sent to the model: the first ones of the set, so the prompt (and its cache) stays a fixed size. */
export const EXERCISE_MAX_CARDS = 100;
export const EXERCISE_BLANK = '{{blank}}';
export const EXERCISE_CHOICES = 4;
export const EXERCISE_MIN_MATCHES = 3;
export const EXERCISE_MAX_MATCHES = 5;

export const ExerciseKindSchema = z.enum(['single_choice', 'completion', 'matching']);
export const ExerciseCountSchema = z.union([z.literal(10), z.literal(20)]);

export const GenerateExerciseRequestSchema = z
  .object({
    kinds: z
      .array(ExerciseKindSchema)
      .min(1)
      .max(ExerciseKindSchema.options.length)
      .refine(kinds => new Set(kinds).size === kinds.length, {message: 'Kinds must be unique.'}),
    count: ExerciseCountSchema,
  })
  .strict();

/** What the model returns: one flat shape for every kind (easier for the model); the server checks each question. */
export const GeneratedExerciseSchema = z.object({
  questions: z
    .array(
      z.object({
        kind: ExerciseKindSchema,
        /** Sentence with `{{blank}}` (single_choice, completion); empty for matching. */
        prompt: z.string(),
        /** single_choice: 4 terms. matching: the terms to choose from. Empty for completion. */
        options: z.array(z.string()),
        /** single_choice, completion: the term that fills the blank. Empty for matching. */
        answer: z.string(),
        /** matching: 3 to 5 sentences with `{{blank}}` and their terms. Empty for the other kinds. */
        items: z.array(z.object({prompt: z.string(), answer: z.string()})),
      }),
    )
    .max(40),
});

const cardId = z.string().uuid();

/** Pick the term that fills the blank; `answer` is one of `options`. */
export const SingleChoiceExerciseSchema = z.object({
  kind: z.literal('single_choice'),
  cardId,
  prompt: z.string(),
  options: z.array(z.string()).length(EXERCISE_CHOICES),
  answer: z.string(),
});
/** Type the term that fills the blank. */
export const CompletionExerciseSchema = z.object({
  kind: z.literal('completion'),
  cardId,
  prompt: z.string(),
  answer: z.string(),
});
/** Match each sentence with its term; `options` holds every answer and maybe a few spare terms. */
export const MatchingExerciseSchema = z.object({
  kind: z.literal('matching'),
  items: z
    .array(z.object({cardId, prompt: z.string(), answer: z.string()}))
    .min(EXERCISE_MIN_MATCHES)
    .max(EXERCISE_MAX_MATCHES),
  options: z.array(z.string()),
});

export const ExerciseQuestionSchema = z.discriminatedUnion('kind', [
  SingleChoiceExerciseSchema,
  CompletionExerciseSchema,
  MatchingExerciseSchema,
]);
export const GenerateExerciseResponseSchema = z.object({
  setId: z.string().uuid(),
  questions: z.array(ExerciseQuestionSchema),
});

export type ExerciseKind = z.infer<typeof ExerciseKindSchema>;
export type GenerateExerciseRequest = z.infer<typeof GenerateExerciseRequestSchema>;
export type GeneratedExercise = z.infer<typeof GeneratedExerciseSchema>;
export type ExerciseQuestion = z.infer<typeof ExerciseQuestionSchema>;
export type GenerateExerciseResponse = z.infer<typeof GenerateExerciseResponseSchema>;
