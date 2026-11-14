import {z} from 'zod';

import {SkillSchema} from '../exam/certifications';
import {QuestionKindSchema} from '../exam/question-kinds';
import {CardStateSchema} from '../flashcard/study';

// Personal dashboard (PLAN C6). Every endpoint returns only the signed-in user's data; days are Vietnam days (UTC+7).

/** Calendar day in Vietnam time, `YYYY-MM-DD`. */
export const StatsDateSchema = z.iso.date();
/** The activity calendar shows 52 weeks; a longer range is refused. */
export const MAX_ACTIVITY_DAYS = 366;
/** A question kind needs this many answers before it can be marked the weakest. */
export const MIN_ANSWERS_FOR_WEAKNESS = 5;

const count = z.number().int().nonnegative();
const band = z.number().min(0).max(9);

export const StreakSchema = z.object({
  /** Days in a row with activity, ending today (or yesterday when today has none yet). */
  current: count,
  longest: count,
});

const SkillBandsSchema = z.object({best: band.nullable(), latest: band.nullable()});

/** `GET /stats/overview`: the number cards. */
export const StatsOverviewResponseSchema = z.object({
  /** Submitted attempts. */
  testsTaken: count,
  bands: z.object({listening: SkillBandsSchema, reading: SkillBandsSchema}),
  targetBand: band.nullable(),
  words: count,
  /** Words whose best card is mastered (interval of 21 days or more). */
  masteredWords: count,
  /** Card ratings ever given. */
  cardsReviewed: count,
  /** Ended study sessions plus submitted attempts, in whole minutes. */
  studyMinutes: count,
  streak: StreakSchema,
});

/** `GET /stats/activity?from&to`: both optional, default the 52 weeks ending today. */
export const StatsActivityQuerySchema = z.object({
  from: StatsDateSchema.optional(),
  to: StatsDateSchema.optional(),
});

export const ActivityDaySchema = z.object({
  date: StatsDateSchema,
  lookups: count,
  savedWords: count,
  reviews: count,
  attempts: count,
  total: count,
});

export const StatsActivityResponseSchema = z.object({
  from: StatsDateSchema,
  to: StatsDateSchema,
  /** Only days with activity, oldest first; missing days count 0. */
  days: z.array(ActivityDaySchema),
  streak: StreakSchema,
});

export const BandPointSchema = z.object({
  attemptId: z.uuid(),
  testTitle: z.string(),
  submittedAt: z.iso.datetime(),
  /** Null when the test has no section of that skill. */
  listening: band.nullable(),
  reading: band.nullable(),
});

/** `GET /stats/bands`: submitted attempts, oldest first, and the target band line. */
export const StatsBandsResponseSchema = z.object({
  targetBand: band.nullable(),
  points: z.array(BandPointSchema),
});

/** `GET /stats/vocab`: growth per week, word states and top topics. */
export const StatsVocabResponseSchema = z.object({
  total: count,
  /** Word state = its best card's state; a word without cards is new. */
  states: z.record(CardStateSchema, count),
  /** Last 12 Vietnam weeks (Monday first), oldest first, including weeks with 0. */
  weekly: z.array(z.object({weekStart: StatsDateSchema, added: count})),
  /** At most 10 topics, most words first. */
  topics: z.array(z.object({topic: z.string(), words: count})),
});

export const KindAccuracySchema = z.object({
  skill: SkillSchema,
  kind: QuestionKindSchema,
  answered: count,
  correct: count,
  /** correct / answered, 0..1. */
  accuracy: z.number().min(0).max(1),
});

/** `GET /stats/weaknesses`: accuracy per question kind over submitted attempts, weakest first. */
export const StatsWeaknessesResponseSchema = z.object({
  kinds: z.array(KindAccuracySchema),
  /** Lowest accuracy among kinds with at least MIN_ANSWERS_FOR_WEAKNESS answers; the client shows practice tips. */
  weakest: KindAccuracySchema.pick({skill: true, kind: true}).nullable(),
});

/** `GET /stats/community` (after P4-02): what the user published and how others used it. */
export const StatsCommunityResponseSchema = z.object({
  publishedSets: count,
  setCopies: count,
  publishedTests: count,
  testAttempts: count,
});

export type Streak = z.infer<typeof StreakSchema>;
export type StatsOverviewResponse = z.infer<typeof StatsOverviewResponseSchema>;
export type StatsActivityQuery = z.infer<typeof StatsActivityQuerySchema>;
export type ActivityDay = z.infer<typeof ActivityDaySchema>;
export type StatsActivityResponse = z.infer<typeof StatsActivityResponseSchema>;
export type BandPoint = z.infer<typeof BandPointSchema>;
export type StatsBandsResponse = z.infer<typeof StatsBandsResponseSchema>;
export type StatsVocabResponse = z.infer<typeof StatsVocabResponseSchema>;
export type KindAccuracy = z.infer<typeof KindAccuracySchema>;
export type StatsWeaknessesResponse = z.infer<typeof StatsWeaknessesResponseSchema>;
export type StatsCommunityResponse = z.infer<typeof StatsCommunityResponseSchema>;
