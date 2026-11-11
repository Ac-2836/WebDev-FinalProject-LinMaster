import type {StudyCard} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {rate, startQueue} from './learn-queue';

const card = (term: string) => ({id: term, term}) as unknown as StudyCard;

describe('learn queue', () => {
  it('finishes a card on hard, good or easy', () => {
    let q = startQueue([card('a'), card('b'), card('c')]);
    q = rate(q, 'good');
    q = rate(q, 'hard');
    q = rate(q, 'easy');
    expect(q.queue).toEqual([]);
    expect(q.done).toBe(3);
    expect(q.tally).toEqual({again: 0, hard: 1, good: 1, easy: 1});
  });

  it('sends a forgotten card to the back of the session', () => {
    let q = startQueue([card('a'), card('b')]);
    q = rate(q, 'again');
    expect(q.queue.map(c => c.term)).toEqual(['b', 'a']);
    expect(q.done).toBe(0);
    q = rate(rate(q, 'good'), 'good');
    expect(q.queue).toEqual([]);
    expect(q.done).toBe(2);
    expect(q.tally.again).toBe(1);
  });

  it('ignores a rating when nothing is left', () => {
    const q = startQueue([]);
    expect(rate(q, 'good')).toEqual(q);
  });
});
