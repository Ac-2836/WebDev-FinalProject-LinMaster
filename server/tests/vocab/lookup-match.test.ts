import {describe, expect, it} from 'vitest';

import {droppedMeaning, locatePhrase, selectionRange} from '../../src/modules/vocab/lookup-match';

describe('selectionRange', () => {
  it('uses textStart, or the first occurrence, and numbers repeated text', () => {
    const sentence = 'The bank near the river bank';
    expect(selectionRange('bank', sentence)).toEqual({start: 4, end: 8, occurrence: 1});
    expect(selectionRange('bank', sentence, 24)).toEqual({start: 24, end: 28, occurrence: 2});
    expect(selectionRange('river', sentence)).toEqual({start: 18, end: 23, occurrence: undefined});
  });
});

describe('locatePhrase', () => {
  const sentence = 'Teachers  who give\nfrequent feedback help students. Feedback matters.';
  const selection = {start: 0, end: 26};

  it('finds the phrase ignoring case, spacing and punctuation, and reports the sentence text', () => {
    expect(locatePhrase('Give Frequent Feedback.', sentence, selection)).toMatchObject({
      text: 'give\nfrequent feedback',
      start: 14,
    });
  });

  it('refuses text that is missing, mid-word, away from the selection or longer than 6 words', () => {
    expect(locatePhrase('regression', sentence, selection)).toBeNull();
    expect(locatePhrase('feed', sentence, {start: 24, end: 28})).toBeNull();
    expect(locatePhrase('students', sentence, selection)).toBeNull();
    expect(locatePhrase('Teachers who give frequent feedback help students', sentence, selection)).toBeNull();
  });

  it('picks the occurrence that overlaps the selection most', () => {
    const where = sentence.lastIndexOf('Feedback');
    expect(locatePhrase('feedback', sentence, {start: where, end: where + 8})).toMatchObject({start: where});
  });
});

describe('droppedMeaning', () => {
  const selection = {start: 0, text: 'online courses'};

  it('is true when a meaningful word is lost, false when only function words are', () => {
    expect(droppedMeaning(selection, {start: 7, end: 14})).toBe(true);
    expect(droppedMeaning({start: 0, text: 'the regression'}, {start: 4, end: 14})).toBe(false);
    expect(droppedMeaning({start: 0, text: 'regression'}, {start: 0, end: 10})).toBe(false);
    expect(droppedMeaning({start: 0, text: 'Teachers who give frequent'}, {start: 13, end: 35})).toBe(false);
  });
});
