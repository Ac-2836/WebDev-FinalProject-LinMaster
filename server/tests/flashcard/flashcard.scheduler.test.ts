import {cardStateOf, MASTERED_INTERVAL_DAYS, type Rating} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {
  DEFAULT_EASINESS,
  MIN_EASINESS,
  nextEasiness,
  scheduleReview,
  type Sm2State,
} from '../../src/modules/flashcard/flashcard.scheduler';

const NOW = new Date('2026-11-10T03:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** Rates a card several times in a row, starting from a never-rated card. */
function rateInOrder(ratings: Rating[]): Sm2State {
  let state: Sm2State | null = null;
  for (const rating of ratings) state = scheduleReview(state, rating, NOW);
  return state!;
}

describe('SM-2 easiness', () => {
  it('follows the SM-2 formula for each rating', () => {
    expect(nextEasiness(DEFAULT_EASINESS, 'easy')).toBe(2.6);
    expect(nextEasiness(DEFAULT_EASINESS, 'good')).toBe(2.5);
    expect(nextEasiness(DEFAULT_EASINESS, 'hard')).toBe(2.36);
    expect(nextEasiness(DEFAULT_EASINESS, 'again')).toBe(2.18);
  });

  it('never drops below 1.3', () => {
    expect(nextEasiness(1.35, 'again')).toBe(MIN_EASINESS);
    expect(rateInOrder(['again', 'again', 'again', 'again', 'again']).easiness).toBe(MIN_EASINESS);
  });
});

describe('scheduleReview', () => {
  it('schedules a new card rated Good for tomorrow', () => {
    const next = scheduleReview(null, 'good', NOW);

    expect(next).toMatchObject({easiness: 2.5, intervalDays: 1, repetitions: 1, lapses: 0});
    expect(next.dueAt.getTime()).toBe(NOW.getTime() + DAY_MS);
  });

  it('uses 1 day, then 6 days, then interval × easiness for correct recalls in a row', () => {
    const first = scheduleReview(null, 'good', NOW);
    const second = scheduleReview(first, 'good', NOW);
    const third = scheduleReview(second, 'good', NOW);
    const fourth = scheduleReview(third, 'good', NOW);

    expect([first, second, third, fourth].map(state => state.intervalDays)).toEqual([1, 6, 15, 38]);
    expect(fourth.repetitions).toBe(4);
    expect(fourth.dueAt.getTime()).toBe(NOW.getTime() + 38 * DAY_MS);
  });

  it('grows the interval faster with Easy and slower with Hard', () => {
    const base: Sm2State = {easiness: 2.5, intervalDays: 6, repetitions: 2, lapses: 0};

    expect(scheduleReview(base, 'easy', NOW)).toMatchObject({easiness: 2.6, intervalDays: 16, repetitions: 3});
    expect(scheduleReview(base, 'good', NOW)).toMatchObject({easiness: 2.5, intervalDays: 15, repetitions: 3});
    expect(scheduleReview(base, 'hard', NOW)).toMatchObject({easiness: 2.36, intervalDays: 14, repetitions: 3});
  });

  it('resets a forgotten card: repetitions 0, interval 1 day, one more lapse', () => {
    const mastered: Sm2State = {easiness: 2.5, intervalDays: 38, repetitions: 4, lapses: 0};
    const next = scheduleReview(mastered, 'again', NOW);

    expect(next).toMatchObject({easiness: 2.18, intervalDays: 1, repetitions: 0, lapses: 1});
    expect(next.dueAt.getTime()).toBe(NOW.getTime() + DAY_MS);
  });

  it('does not count Again on a card that was never recalled as a lapse', () => {
    expect(scheduleReview(null, 'again', NOW)).toMatchObject({repetitions: 0, lapses: 0, intervalDays: 1});
    expect(rateInOrder(['again', 'again']).lapses).toBe(0);
  });

  it('starts the 1 day / 6 day steps again after a lapse, keeping the lower easiness', () => {
    const state = rateInOrder(['good', 'good', 'good', 'again', 'good', 'good']);

    expect(state).toMatchObject({repetitions: 2, intervalDays: 6, lapses: 1, easiness: 2.18});
  });

  it('keeps at least a 1 day interval', () => {
    const odd: Sm2State = {easiness: 1.3, intervalDays: 0, repetitions: 2, lapses: 0};
    expect(scheduleReview(odd, 'hard', NOW).intervalDays).toBe(1);
  });

  it('does not change the stored state it was given', () => {
    const state: Sm2State = {easiness: 2.5, intervalDays: 6, repetitions: 2, lapses: 0};
    scheduleReview(state, 'again', NOW);
    expect(state).toEqual({easiness: 2.5, intervalDays: 6, repetitions: 2, lapses: 0});
  });
});

describe('card state (st-04)', () => {
  it('is new without progress, learning below 21 days and mastered from 21 days', () => {
    expect(cardStateOf(null)).toBe('new');
    expect(cardStateOf({intervalDays: 1})).toBe('learning');
    expect(cardStateOf({intervalDays: MASTERED_INTERVAL_DAYS - 1})).toBe('learning');
    expect(cardStateOf({intervalDays: MASTERED_INTERVAL_DAYS})).toBe('mastered');
  });

  it('moves New → Learning → Mastered with Good, and back to Learning with Again', () => {
    const states = ['good', 'good', 'good', 'good', 'again'].reduce<{state: Sm2State | null; seen: string[]}>(
      ({state, seen}, rating) => {
        const next = scheduleReview(state, rating as Rating, NOW);
        return {state: next, seen: [...seen, cardStateOf(next)]};
      },
      {state: null, seen: []},
    ).seen;

    expect(states).toEqual(['learning', 'learning', 'learning', 'mastered', 'learning']);
  });
});
