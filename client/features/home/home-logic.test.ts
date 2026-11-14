import type {AttemptSummary} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {greeting, runningAttempt, timeLeft, vnDay} from './home-logic';

const now = new Date('2026-11-14T18:30:00Z'); // 01:30 on 15/11 in Vietnam

describe('home', () => {
  it('counts days and greets in Vietnam time', () => {
    expect(vnDay(now)).toBe('2026-11-15');
    expect(vnDay(now, -6)).toBe('2026-11-09');
    expect(greeting(now)).toBe('morning');
    expect(greeting(new Date('2026-11-14T08:00:00Z'))).toBe('afternoon');
    expect(greeting(new Date('2026-11-14T13:00:00Z'))).toBe('evening');
  });

  it('finds the running attempt and its time left', () => {
    const a = (status: string, deadlineAt: string) =>
      ({status, startedAt: '2026-11-14T18:00:00Z', deadlineAt}) as AttemptSummary;
    expect(
      runningAttempt([a('submitted', '2026-11-14T19:00:00Z'), a('in_progress', '2026-11-14T18:00:30Z')], now),
    ).toBeNull();
    const running = a('in_progress', '2026-11-14T19:00:00Z');
    expect(runningAttempt([running], now)).toBe(running);
    expect(timeLeft(running, now)).toEqual({minutes: 30, used: 0.5});
  });
});
