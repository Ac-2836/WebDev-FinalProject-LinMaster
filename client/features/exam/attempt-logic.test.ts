import {EMPTY_ATTEMPT_STATE, type AttemptState, type CandidateSection} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {
  answeredNumbers,
  answersByNumber,
  flaggedNumbers,
  passageMarks,
  questionIndex,
  sectionParts,
  setAnswers,
  setPassageMarks,
  startQuestion,
  toggleFlag,
} from './attempt-logic';

const question = (number: number) => ({id: `q${number}`, number, prompt: '', options: null});
const group = (from: number, to: number) => ({
  id: `g${from}`,
  kind: 'short_answer' as const,
  fromNo: from,
  toNo: to,
  instructions: '',
  wordLimit: null,
  shared: null,
  questions: Array.from({length: to - from + 1}, (_, i) => question(from + i)),
});
const section: CandidateSection = {
  id: 's1',
  skill: 'reading',
  position: 1,
  durationSec: 3600,
  hasAudio: false,
  passages: [
    {id: 'p1', position: 1, title: 'A', paragraphs: [], audioStartSec: null, groups: [group(1, 3), group(4, 5)]},
    {id: 'p2', position: 2, title: 'B', paragraphs: [], audioStartSec: null, groups: [group(6, 8)]},
  ],
};

describe('attempt state in the room', () => {
  it('makes one Part per passage', () => {
    expect(sectionParts(section)).toEqual([
      {id: 'p1', title: 'Part 1', questions: [1, 2, 3, 4, 5]},
      {id: 'p2', title: 'Part 2', questions: [6, 7, 8]},
    ]);
  });

  it('reads answers and flags saved by question id as numbers', () => {
    const {numberOf} = questionIndex(section);
    const state: AttemptState = {
      ...EMPTY_ATTEMPT_STATE,
      answers: {q2: 'B', q3: '  ', q7: null, other: 'A'},
      flags: ['q5', 'other'],
    };
    expect([...answeredNumbers(state, numberOf)]).toEqual([2]);
    expect([...flaggedNumbers(state, numberOf)]).toEqual([5]);
  });

  it('toggles a review flag', () => {
    const once = toggleFlag(EMPTY_ATTEMPT_STATE, 'q4');
    expect(once.flags).toEqual(['q4']);
    expect(toggleFlag(once, 'q4').flags).toEqual([]);
  });

  it('reopens at the saved question of this section only', () => {
    const parts = sectionParts(section);
    expect(startQuestion(EMPTY_ATTEMPT_STATE, section, parts)).toBe(1);
    const at7 = {...EMPTY_ATTEMPT_STATE, position: {sectionId: 's1', questionId: 'q7'}};
    expect(startQuestion(at7, section, parts)).toBe(7);
    const otherSection = {...EMPTY_ATTEMPT_STATE, position: {sectionId: 's0', questionId: 'q7'}};
    expect(startQuestion(otherSection, section, parts)).toBe(1);
  });
});

describe('answers and highlights by question number', () => {
  it('maps answers between numbers and ids, removing emptied ones', () => {
    const {idOf, numberOf} = questionIndex(section);
    const state = setAnswers({...EMPTY_ATTEMPT_STATE, answers: {q1: 'A', q2: 'B'}}, {2: null, 6: 'iv'}, idOf);
    expect(state.answers).toEqual({q1: 'A', q6: 'iv'});
    expect(answersByNumber(state, numberOf)).toEqual({1: 'A', 6: 'iv'});
  });

  it('saves highlights and notes per passage and reads them back', () => {
    const other = {passageId: 'p2', paragraph: 0, start: 0, end: 4};
    const start: AttemptState = {...EMPTY_ATTEMPT_STATE, highlights: [other], notes: [{...other, text: 'keep'}]};
    const state = setPassageMarks(start, 'p1', [
      {paragraph: 1, start: 2, end: 9, note: 'date'},
      {paragraph: 2, start: 0, end: 3},
    ]);
    expect(state.highlights).toHaveLength(3);
    expect(state.notes).toEqual([
      {...other, text: 'keep'},
      {passageId: 'p1', paragraph: 1, start: 2, end: 9, text: 'date'},
    ]);
    expect(passageMarks(state, 'p1')).toEqual([
      {paragraph: 1, start: 2, end: 9, note: 'date'},
      {paragraph: 2, start: 0, end: 3},
    ]);
  });
});
