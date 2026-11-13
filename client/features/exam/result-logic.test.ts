import type {ResultQuestion} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {givenText, kindAccuracy, minutesBetween, overallBand} from './result-logic';

const q = (kind: ResultQuestion['kind'], isCorrect: boolean) => ({kind, isCorrect}) as ResultQuestion;

describe('result', () => {
  it('rounds the mean band to a half band', () => {
    expect(overallBand([])).toBeNull();
    expect(
      overallBand([
        {skill: 'listening', correct: 28, total: 40, band: 6.5},
        {skill: 'reading', correct: 31, total: 40, band: 7},
      ]),
    ).toBe(7);
    expect(overallBand([{skill: 'reading', correct: 20, total: 40, band: 5.5}])).toBe(5.5);
  });

  it('gives the accuracy per question kind, weakest first', () => {
    expect(kindAccuracy([q('tfng', true), q('tfng', false), q('completion', true), q('matching', false)])).toEqual([
      {kind: 'matching', correct: 0, total: 1, percent: 0},
      {kind: 'tfng', correct: 1, total: 2, percent: 50},
      {kind: 'completion', correct: 1, total: 1, percent: 100},
    ]);
  });

  it('counts minutes and blanks', () => {
    expect(minutesBetween('2026-11-13T10:00:00Z', '2026-11-13T11:48:20Z')).toBe(108);
    expect(minutesBetween('2026-11-13T10:00:00Z', '2026-11-13T10:00:10Z')).toBe(1);
    expect(givenText('  ')).toBeNull();
    expect(givenText('B')).toBe('B');
  });
});
