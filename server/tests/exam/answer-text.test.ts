import {describe, expect, it} from 'vitest';
import {countWords, expandOptionalWords, normalizeText, splitAnswerKey} from '@linmaster/shared';

describe('answer text helpers', () => {
  it('normalizes case, spaces, quotes, dashes, separators and end punctuation', () => {
    expect(normalizeText('  The  Public\tLibrary. ')).toBe('the public library');
    expect(normalizeText('“Children’s”')).toBe("children's");
    expect(normalizeText('9–5')).toBe('9-5');
    expect(normalizeText('1,500,000')).toBe('1500000');
    expect(normalizeText('1,50')).toBe('1,50');
  });

  it('counts words like the IELTS word limit', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('part-time job')).toBe(2);
    expect(countWords('25 metres')).toBe(1);
    expect(countWords('£20 per hour')).toBe(2);
    expect(countWords('9:30 am')).toBe(1);
  });

  it('expands optional words in brackets', () => {
    expect(expandOptionalWords('(the) car park')).toEqual(['the car park', ' car park']);
    expect(expandOptionalWords('(a) (big) box').map(value => normalizeText(value))).toEqual([
      'a big box',
      'a box',
      'big box',
      'box',
    ]);
    expect(expandOptionalWords('library')).toEqual(['library']);
  });

  it('splits an answer key cell into its spellings', () => {
    expect(splitAnswerKey('color/colour')).toEqual(['color', 'colour']);
    expect(splitAnswerKey('car park / parking lot')).toEqual(['car park', 'parking lot']);
    expect(splitAnswerKey('bus OR coach')).toEqual(['bus', 'coach']);
    expect(splitAnswerKey('bread or rice')).toEqual(['bread or rice']);
    expect(splitAnswerKey('24/7')).toEqual(['24/7']);
  });
});
