import {describe, expect, it} from 'vitest';

import {correctAnswer, isTypedCorrect, normalizeAnswer, percent} from './quiz-logic';

describe('typed answers', () => {
  it('ignores case, extra spaces and punctuation at the ends', () => {
    expect(normalizeAnswer('  Bio  Diversity. ')).toBe('bio diversity');
    expect(isTypedCorrect(' Biodiversity! ', 'biodiversity')).toBe(true);
  });

  it('rejects empty and different answers', () => {
    expect(isTypedCorrect('   ', 'biodiversity')).toBe(false);
    expect(isTypedCorrect('biodiverse', 'biodiversity')).toBe(false);
  });
});

describe('correctAnswer and percent', () => {
  const id = '00000000-0000-4000-8000-000000000000';
  it('describes the right answer by question kind', () => {
    expect(correctAnswer({kind: 'written', cardId: id, prompt: 'p', answer: 'a'})).toEqual({kind: 'text', text: 'a'});
    expect(correctAnswer({kind: 'true-false', cardId: id, prompt: 'p', statement: 's', answer: false})).toEqual({
      kind: 'boolean',
      value: false,
    });
  });

  it('rounds the score and handles no questions', () => {
    expect(percent(4, 5)).toBe(80);
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});
