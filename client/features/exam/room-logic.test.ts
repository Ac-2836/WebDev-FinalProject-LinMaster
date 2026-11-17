import {describe, expect, it} from 'vitest';

import {
  adjacentQuestion,
  clockOffset,
  crossedWarning,
  formatRemaining,
  isWarningTime,
  partProgress,
  questionState,
  remainingMs,
  retryDelay,
  submitSummary,
  type RoomPart,
} from './room-logic';

const MIN = 60_000;

describe('server clock', () => {
  it('uses the server time, not the device time', () => {
    const device = Date.parse('2026-11-12T10:00:00Z');
    // Device clock is 5 minutes fast.
    const offset = clockOffset('2026-11-12T09:55:00Z', device);
    expect(remainingMs('2026-11-12T10:55:00Z', offset, device)).toBe(60 * MIN);
    expect(remainingMs('2026-11-12T10:55:00Z', offset, device + 30 * MIN)).toBe(30 * MIN);
  });

  it('never goes below zero', () => {
    expect(remainingMs('2026-11-12T10:00:00Z', 0, Date.parse('2026-11-12T11:00:00Z'))).toBe(0);
  });
});

describe('formatRemaining', () => {
  it('rounds minutes up and switches to seconds in the last minute', () => {
    expect(formatRemaining(38 * MIN)).toBe('38 minutes left');
    expect(formatRemaining(37 * MIN + 1)).toBe('38 minutes left');
    expect(formatRemaining(MIN)).toBe('1 minute left');
    expect(formatRemaining(59_500)).toBe('60 seconds left');
    expect(formatRemaining(1000)).toBe('1 second left');
    expect(formatRemaining(0)).toBe('0 seconds left');
  });
});

describe('crossedWarning', () => {
  it('fires once when crossing 10 and 5 minutes', () => {
    expect(crossedWarning(10 * MIN + 500, 10 * MIN - 500)).toBe(10);
    expect(crossedWarning(10 * MIN - 500, 10 * MIN - 1500)).toBeNull();
    expect(crossedWarning(5 * MIN + 1, 5 * MIN)).toBe(5);
  });

  it('stays quiet on the first tick and picks the smaller mark on a jump', () => {
    expect(crossedWarning(null, 7 * MIN)).toBeNull();
    expect(crossedWarning(11 * MIN, 4 * MIN)).toBe(5);
  });

  it('marks warning time from 10 minutes', () => {
    expect(isWarningTime(10 * MIN)).toBe(true);
    expect(isWarningTime(10 * MIN + 1)).toBe(false);
  });
});

describe('question navigation', () => {
  const parts: RoomPart[] = [
    {id: 'p1', title: 'Part 1', questions: [1, 2, 3]},
    {id: 'p2', title: 'Part 2', questions: [4, 5]},
  ];
  const answered = new Set([1, 3, 4]);

  it('moves across parts and stops at the ends', () => {
    expect(adjacentQuestion(parts, 3, 1)).toBe(4);
    expect(adjacentQuestion(parts, 4, -1)).toBe(3);
    expect(adjacentQuestion(parts, 1, -1)).toBeNull();
    expect(adjacentQuestion(parts, 5, 1)).toBeNull();
    expect(adjacentQuestion(parts, 99, 1)).toBeNull();
  });

  it('gives each number its state', () => {
    expect(questionState(1, 1, answered)).toBe('current');
    expect(questionState(3, 1, answered)).toBe('answered');
    expect(questionState(2, 1, answered)).toBe('unanswered');
  });

  it('counts progress and the submit summary', () => {
    expect(partProgress(parts[0], answered)).toEqual({done: 2, total: 3});
    expect(submitSummary(parts, answered, new Set([2, 5]))).toEqual({
      total: 5,
      answered: 3,
      unanswered: [2, 5],
      flagged: 2,
    });
  });
});

describe('retryDelay', () => {
  it('backs off from 2 s up to 30 s and stays there', () => {
    expect([1, 2, 3, 4, 5, 6, 40].map(retryDelay)).toEqual([2000, 5000, 10_000, 20_000, 30_000, 30_000, 30_000]);
  });

  it('treats 0 failures like the first one', () => {
    expect(retryDelay(0)).toBe(2000);
  });
});
