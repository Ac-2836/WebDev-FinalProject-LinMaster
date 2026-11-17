import type {ExerciseQuestion} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {grade, ordered, splitBlank, unitsOf, withKind} from './exercise-logic';

const id = '00000000-0000-4000-8000-000000000001';
const questions: ExerciseQuestion[] = [
  {
    kind: 'matching',
    options: ['mitigate', 'erosion', 'spare'],
    items: [
      {cardId: id, prompt: 'To reduce the ____.', answer: 'mitigate'},
      {cardId: id, prompt: 'The wearing away of land is ____.', answer: 'erosion'},
      {cardId: id, prompt: 'Third ____.', answer: 'spare'},
    ],
  },
  {kind: 'completion', cardId: id, prompt: 'Councils ______ to {{blank}} the risk.', answer: 'mitigate'},
  {
    kind: 'single_choice',
    cardId: id,
    prompt: 'They {{blank}} the risk.',
    options: ['a', 'mitigate', 'c', 'd'],
    answer: 'mitigate',
  },
];

describe('ordered and unitsOf', () => {
  it('puts choices first, then gaps, then matching, and numbers every answer', () => {
    const units = unitsOf(ordered(questions));
    expect(units.map(u => [u.number, u.kind, u.key])).toEqual([
      [1, 'single_choice', '0'],
      [2, 'completion', '1'],
      [3, 'matching', '2.0'],
      [4, 'matching', '2.1'],
      [5, 'matching', '2.2'],
    ]);
    expect(units[0].options).toHaveLength(4);
    expect(units[2].options).toEqual(['mitigate', 'erosion', 'spare']);
  });
});

describe('splitBlank', () => {
  it('splits at the first gap and turns the others into a line', () => {
    expect(splitBlank('A {{blank}} b {{blank}} c')).toEqual({before: 'A ', after: ' b ____ c'});
    expect(splitBlank('No gap here.')).toBeNull();
  });
});

describe('grade', () => {
  it('compares each answer ignoring case and spaces, and counts blanks as wrong', () => {
    const units = unitsOf(ordered(questions));
    const graded = grade(units, {'0': 'mitigate', '1': ' Mitigate. ', '2.0': 'mitigate', '2.1': 'spare'});
    expect(graded.results).toEqual({'0': true, '1': true, '2.0': true, '2.1': false, '2.2': false});
    expect(graded).toMatchObject({correct: 3, total: 5});
  });
});

describe('withKind', () => {
  it('adds and removes a kind keeping the exam order', () => {
    expect(withKind(['completion'], 'single_choice', true)).toEqual(['single_choice', 'completion']);
    expect(withKind(['single_choice', 'completion'], 'single_choice', false)).toEqual(['completion']);
  });
});
