import {describe, expect, it} from 'vitest';

import {
  addHighlights,
  clearHighlights,
  isAnswered,
  multiChoiceSelected,
  overWordLimit,
  segments,
  setNote,
  splitBlank,
  splitGaps,
  toggleMultiChoice,
  toggleStruck,
} from './reading-logic';

describe('answers', () => {
  it('treats blank and whitespace as unanswered', () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered(null)).toBe(false);
    expect(isAnswered('  ')).toBe(false);
    expect(isAnswered('A')).toBe(true);
  });

  it('counts words like the grader: numbers and hyphenated words', () => {
    expect(overWordLimit('the public library', 2)).toBe(true);
    expect(overWordLimit('public library', 2)).toBe(false);
    expect(overWordLimit('well-known writer', 2)).toBe(false);
    expect(overWordLimit('25 kilometres', 1)).toBe(false);
    expect(overWordLimit('anything at all here', null)).toBe(false);
    expect(overWordLimit('', 1)).toBe(false);
  });

  it('splits a completion prompt at the blank', () => {
    expect(splitBlank('Glass was used in {{blank}} that told stories.')).toEqual([
      'Glass was used in ',
      ' that told stories.',
    ]);
    expect(splitBlank('No gap')).toBeNull();
    expect(splitGaps('Name: Daniel {{1}}')).toEqual(['Name: Daniel ', 1]);
    expect(splitGaps('{{8}} and {{9}} p.m.')).toEqual([8, ' and ', 9, ' p.m.']);
  });
});

describe('multi choice (choose TWO letters)', () => {
  const numbers = [21, 22];

  it('stores ticked letters one per question, sorted', () => {
    const first = toggleMultiChoice(numbers, {}, 'D')!;
    expect(first).toEqual({21: 'D', 22: null});
    const second = toggleMultiChoice(numbers, first, 'B')!;
    expect(second).toEqual({21: 'B', 22: 'D'});
    expect(multiChoiceSelected(numbers, second)).toEqual(['B', 'D']);
  });

  it('unticks and refuses a third letter', () => {
    const answers = {21: 'B', 22: 'D'};
    expect(toggleMultiChoice(numbers, answers, 'E')).toBeNull();
    expect(toggleMultiChoice(numbers, answers, 'B')).toEqual({21: 'D', 22: null});
  });
});

describe('highlights', () => {
  it('merges overlapping and touching ranges and keeps notes', () => {
    const list = addHighlights([{paragraph: 0, start: 0, end: 5, note: 'check'}], [{paragraph: 0, start: 5, end: 9}]);
    expect(list).toEqual([{paragraph: 0, start: 0, end: 9, note: 'check'}]);
  });

  it('keeps ranges in other paragraphs apart and ignores empty ranges', () => {
    const list = addHighlights(
      [{paragraph: 1, start: 0, end: 3}],
      [
        {paragraph: 0, start: 2, end: 4},
        {paragraph: 0, start: 7, end: 7},
      ],
    );
    expect(list).toEqual([
      {paragraph: 0, start: 2, end: 4},
      {paragraph: 1, start: 0, end: 3},
    ]);
  });

  it('clears the highlights a selection touches', () => {
    const list = [
      {paragraph: 0, start: 0, end: 4},
      {paragraph: 0, start: 10, end: 14},
    ];
    expect(clearHighlights(list, [{paragraph: 0, start: 2, end: 3}])).toEqual([{paragraph: 0, start: 10, end: 14}]);
  });

  it('sets and removes a note', () => {
    const list = [{paragraph: 0, start: 0, end: 4}];
    const withNote = setNote(list, 0, 'Q17?');
    expect(withNote).toEqual([{paragraph: 0, start: 0, end: 4, note: 'Q17?'}]);
    expect(setNote(withNote, 0, ' ')).toEqual(list);
  });

  it('cuts a paragraph into plain and highlighted segments', () => {
    const list = [
      {paragraph: 1, start: 0, end: 2},
      {paragraph: 0, start: 6, end: 11},
    ];
    expect(segments('Hello world!', 0, list)).toEqual([
      {text: 'Hello ', highlight: -1},
      {text: 'world', highlight: 1},
      {text: '!', highlight: -1},
    ]);
  });

  it('clamps ranges beyond the text', () => {
    expect(segments('abc', 0, [{paragraph: 0, start: 1, end: 99}])).toEqual([
      {text: 'a', highlight: -1},
      {text: 'bc', highlight: 0},
    ]);
  });
});

describe('cross out', () => {
  it('toggles an option per question', () => {
    const once = toggleStruck({}, 19, 'NOT GIVEN');
    expect(once).toEqual({19: ['NOT GIVEN']});
    expect(toggleStruck(once, 19, 'NOT GIVEN')).toEqual({19: []});
  });
});
