import {z} from 'zod';

import {FlashcardCardSchema, MAX_CARDS_PER_SET} from './flashcards';

/** New cards one learner may start per set per Vietnam day (PLAN C3: daily limit in Vietnam time). */
export const NEW_CARDS_PER_DAY = 20;
/** Due cards returned by one study request, so a long break does not produce a huge session. */
export const MAX_DUE_CARDS_PER_STUDY = 200;
/** A card counts as mastered once its interval reaches this many days (state diagram st-04). */
export const MASTERED_INTERVAL_DAYS = 21;

export const RatingSchema = z.enum(['again', 'hard', 'good', 'easy']);
export const StudyModeSchema = z.enum(['flip', 'learn', 'test', 'match', 'exercise']);
/** Derived from CardProgress, never stored (st-04). */
export const CardStateSchema = z.enum(['new', 'learning', 'mastered']);

export type Rating = z.infer<typeof RatingSchema>;
export type StudyMode = z.infer<typeof StudyModeSchema>;
export type CardState = z.infer<typeof CardStateSchema>;

/** New / Learning / Mastered from the SM-2 interval; `null` progress means the card was never rated. */
export function cardStateOf(progress: {intervalDays: number} | null): CardState {
  if (!progress) return 'new';
  return progress.intervalDays >= MASTERED_INTERVAL_DAYS ? 'mastered' : 'learning';
}

export const CardProgressSchema = z.object({
  cardId: z.string().uuid(),
  easiness: z.number(),
  intervalDays: z.number().int().nonnegative(),
  repetitions: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  dueAt: z.iso.datetime(),
  lastReviewedAt: z.iso.datetime().nullable(),
  state: CardStateSchema,
});

export const StudyCardSchema = FlashcardCardSchema.extend({
  state: CardStateSchema,
  progress: CardProgressSchema.nullable(),
});

export const GetStudyCardsResponseSchema = z.object({
  setId: z.string().uuid(),
  /** Due cards first (oldest due first), then new cards in set order. */
  cards: z.array(StudyCardSchema),
  dueCount: z.number().int().nonnegative(),
  newCount: z.number().int().nonnegative(),
  newCardsPerDay: z.number().int().nonnegative(),
  /** New cards still allowed today after this response. */
  newCardsRemaining: z.number().int().nonnegative(),
});

export const ReviewCardRequestSchema = z
  .object({
    cardId: z.string().uuid(),
    rating: RatingSchema,
    sessionId: z.string().uuid().optional(),
  })
  .strict();
export const ReviewCardResponseSchema = z.object({progress: CardProgressSchema});

export const StudySessionSchema = z.object({
  id: z.string().uuid(),
  setId: z.string().uuid(),
  mode: StudyModeSchema,
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  cardsStudied: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
});

export const StartStudySessionRequestSchema = z.object({setId: z.string().uuid(), mode: StudyModeSchema}).strict();

/** Counts are only used for modes without reviews (flip, test, match, exercise); learn counts come from ReviewLog. */
export const EndStudySessionRequestSchema = z
  .object({
    cardsStudied: z.number().int().nonnegative().max(MAX_CARDS_PER_SET).optional(),
    correctCount: z.number().int().nonnegative().max(MAX_CARDS_PER_SET).optional(),
  })
  .strict()
  .refine(
    value =>
      value.cardsStudied === undefined || value.correctCount === undefined || value.correctCount <= value.cardsStudied,
    {message: 'correctCount must not exceed cardsStudied.'},
  );

export const StudySessionIdParamsSchema = z.object({id: z.string().uuid()}).strict();
export const StudySessionResponseSchema = z.object({session: StudySessionSchema});

export const DueSummaryResponseSchema = z.object({
  /** Cards due today (Vietnam time) across every set of the learner. */
  dueCount: z.number().int().nonnegative(),
  /** Sets with at least one due card, most due first. */
  sets: z.array(
    z.object({
      setId: z.string().uuid(),
      title: z.string(),
      dueCount: z.number().int().nonnegative(),
    }),
  ),
});

export type CardProgress = z.infer<typeof CardProgressSchema>;
export type StudyCard = z.infer<typeof StudyCardSchema>;
export type GetStudyCardsResponse = z.infer<typeof GetStudyCardsResponseSchema>;
export type ReviewCardRequest = z.infer<typeof ReviewCardRequestSchema>;
export type StudySession = z.infer<typeof StudySessionSchema>;
export type StartStudySessionRequest = z.infer<typeof StartStudySessionRequestSchema>;
export type EndStudySessionRequest = z.infer<typeof EndStudySessionRequestSchema>;
export type DueSummaryResponse = z.infer<typeof DueSummaryResponseSchema>;
