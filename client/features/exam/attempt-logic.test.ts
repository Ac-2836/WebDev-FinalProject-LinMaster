import {EMPTY_ATTEMPT_STATE, type AttemptState, type CandidateSection} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {answeredNumbers, flaggedNumbers, questionIndex, sectionParts, startQuestion, toggleFlag} from './attempt-logic';

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
