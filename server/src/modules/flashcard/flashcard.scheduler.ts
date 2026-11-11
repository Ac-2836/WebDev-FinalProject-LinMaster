import type {Rating} from '@linmaster/shared';

/** SM-2 starting easiness factor. */
export const DEFAULT_EASINESS = 2.5;
/** SM-2 lower bound for the easiness factor. */
export const MIN_EASINESS = 1.3;
/** Interval after the first and the second correct recall in a row (SM-2). */
export const FIRST_INTERVAL_DAYS = 1;
export const SECOND_INTERVAL_DAYS = 6;
/** A forgotten card comes back the next day (st-04: Again → intervalDays = 1). */
export const LAPSE_INTERVAL_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;
// Recall below this SM-2 quality counts as forgotten.
const PASSING_QUALITY = 3;
// The four buttons map to SM-2 response quality 0–5. Again is a wrong answer that still felt familiar.
const QUALITY_BY_RATING: Record<Rating, number> = {again: 2, hard: 3, good: 4, easy: 5};

export interface Sm2State {
  easiness: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface ScheduledReview extends Sm2State {
  dueAt: Date;
}

/** Progress of a card that was never rated. */
export const NEW_CARD_STATE: Sm2State = {
  easiness: DEFAULT_EASINESS,
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
};

function roundEasiness(value: number): number {
  // Two decimals keep the stored REAL column free of float drift after many reviews.
  return Math.round(value * 100) / 100;
}

/** SM-2 easiness update: EF' = EF + (0.1 − (5 − q)(0.08 + (5 − q)·0.02)), never below 1.3. */
export function nextEasiness(easiness: number, rating: Rating): number {
  const distance = 5 - QUALITY_BY_RATING[rating];
  return Math.max(MIN_EASINESS, roundEasiness(easiness + (0.1 - distance * (0.08 + distance * 0.02))));
}

/**
 * Next SM-2 state after one rating. `previous` is null for a card the learner has never rated.
 * Pure: the caller stores the result in CardProgress and writes the ReviewLog.
 */
export function scheduleReview(previous: Sm2State | null, rating: Rating, now: Date): ScheduledReview {
  const current = previous ?? NEW_CARD_STATE;
  const easiness = nextEasiness(current.easiness, rating);

  let next: Sm2State;
  if (QUALITY_BY_RATING[rating] < PASSING_QUALITY) {
    // A lapse only counts for a card that had been recalled before.
    const lapses = current.repetitions > 0 ? current.lapses + 1 : current.lapses;
    next = {easiness, intervalDays: LAPSE_INTERVAL_DAYS, repetitions: 0, lapses};
  } else {
    const repetitions = current.repetitions + 1;
    let intervalDays: number;
    if (repetitions === 1) intervalDays = FIRST_INTERVAL_DAYS;
    else if (repetitions === 2) intervalDays = SECOND_INTERVAL_DAYS;
    else intervalDays = Math.max(FIRST_INTERVAL_DAYS, Math.round(current.intervalDays * easiness));
    next = {easiness, intervalDays, repetitions, lapses: current.lapses};
  }

  return {...next, dueAt: new Date(now.getTime() + next.intervalDays * DAY_MS)};
}
