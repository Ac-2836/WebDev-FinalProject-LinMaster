import {z} from 'zod';

/** Distractors for a multiple-choice question come from other cards, so a set needs at least this many (PLAN C3). */
export const QUIZ_MIN_CARDS = 4;
export const QUIZ_MAX_QUESTIONS = 50;
export const QUIZ_DEFAULT_QUESTIONS = 20;
export const QUIZ_CHOICES = 4;

export const QuizKindSchema = z.enum(['multiple-choice', 'written', 'true-false']);
const KIND = QuizKindSchema.options.join('|');

export const QuizQuerySchema = z
  .object({
    count: z.coerce.number().int().min(1).max(QUIZ_MAX_QUESTIONS).optional(),
    /** Comma-separated subset of the three kinds; all of them when left out. */
    kinds: z
      .string()
      .regex(new RegExp(`^(${KIND})(,(${KIND}))*$`))
      .optional(),
  })
  .strict();

const cardId = z.string().uuid();

/** Pick the definition that belongs to the term. `answer` is one of `options`. */
export const MultipleChoiceQuestionSchema = z.object({
  kind: z.literal('multiple-choice'),
  cardId,
  prompt: z.string(),
  options: z.array(z.string()).length(QUIZ_CHOICES),
  answer: z.string(),
});
/** Type the term that belongs to the definition (`prompt`). */
export const WrittenQuestionSchema = z.object({
  kind: z.literal('written'),
  cardId,
  prompt: z.string(),
  answer: z.string(),
});
/** Is `statement` the definition of the term (`prompt`)? */
export const TrueFalseQuestionSchema = z.object({
  kind: z.literal('true-false'),
  cardId,
  prompt: z.string(),
  statement: z.string(),
  answer: z.boolean(),
});

export const QuizQuestionSchema = z.discriminatedUnion('kind', [
  MultipleChoiceQuestionSchema,
  WrittenQuestionSchema,
  TrueFalseQuestionSchema,
]);
export const QuizResponseSchema = z.object({setId: z.string().uuid(), questions: z.array(QuizQuestionSchema)});

export type QuizKind = z.infer<typeof QuizKindSchema>;
export type QuizQuery = z.infer<typeof QuizQuerySchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type QuizResponse = z.infer<typeof QuizResponseSchema>;
