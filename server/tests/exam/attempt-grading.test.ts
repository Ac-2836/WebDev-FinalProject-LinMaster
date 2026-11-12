import {describe, expect, it} from 'vitest';
import {EMPTY_ATTEMPT_STATE} from '@linmaster/shared';
import {type AnswerKeySection, correctTexts, explanationOf, gradeAttempt} from '../../src/modules/exam/attempt-grading';

const question = (id: string, number: number, answer: unknown) => ({id, number, answer});

const SECTIONS: AnswerKeySection[] = [
  {
    skill: 'listening',
    groups: [
      {
        kind: 'completion',
        wordLimit: 1,
        questions: [
          question('l1', 1, {accepted: ['library'], explanation: 'She says "library".'}),
          question('l2', 2, {accepted: ['car park']}),
        ],
      },
      {
        kind: 'multi_choice',
        wordLimit: null,
        questions: [question('l3', 3, {choices: ['A', 'C']}), question('l4', 4, {choices: ['A', 'C']})],
      },
    ],
  },
  {
    skill: 'reading',
    groups: [
      {kind: 'tfng', wordLimit: null, questions: [question('r1', 1, {value: 'not given'})]},
      {kind: 'single_choice', wordLimit: null, questions: [question('r2', 2, {key: 'B'})]},
    ],
  },
];

const answers = (given: Record<string, string | null>) => ({...EMPTY_ATTEMPT_STATE, answers: given});

describe('gradeAttempt', () => {
  it('grades every question with the kind registry and snapshots the answer key', () => {
    const graded = gradeAttempt(
      'IELTS_ACADEMIC',
      SECTIONS,
      answers({l1: ' Library ', l2: 'car park now', l3: 'c', l4: 'C', r1: 'NG', r2: 'B'}),
    );

    expect(graded.answers.map(answer => [answer.skill, answer.questionNumber, answer.isCorrect])).toEqual([
      ['listening', 1, true],
      ['listening', 2, false],
      ['listening', 3, true],
      ['listening', 4, false],
      ['reading', 1, true],
      ['reading', 2, false],
    ]);
    expect(graded.answers[0]).toMatchObject({
      questionId: 'l1',
      kind: 'completion',
      given: ' Library ',
      correctAnswer: {accepted: ['library'], explanation: 'She says "library".'},
    });
    expect(graded.answers[4].correctAnswer).toEqual({value: 'NOT GIVEN'});
    // An answer key that does not fit its kind scores 0 and is kept as it was.
    expect(graded.answers[5].correctAnswer).toEqual({key: 'B'});
  });

  it('turns the raw score of each skill into a band, and blanks into null', () => {
    const graded = gradeAttempt('IELTS_ACADEMIC', SECTIONS, answers({l1: 'library', r1: '   '}));

    expect(graded.scores).toEqual([
      {skill: 'listening', correct: 1, total: 4, band: 1},
      {skill: 'reading', correct: 0, total: 2, band: 0},
    ]);
    expect(graded.answers.filter(answer => answer.given === null)).toHaveLength(5);
  });

  it('gives band 0 for an unknown certification', () => {
    expect(gradeAttempt('UNKNOWN', SECTIONS, answers({l1: 'library'})).scores[0]).toMatchObject({correct: 1, band: 0});
  });
});

describe('result helpers', () => {
  it('reads the accepted answers and the explanation of a snapshot', () => {
    expect(correctTexts({value: 'TRUE'})).toEqual(['TRUE']);
    expect(correctTexts({accepted: ['car park', 'parking']})).toEqual(['car park', 'parking']);
    expect(correctTexts({choices: ['A', 'C']})).toEqual(['A', 'C']);
    expect(correctTexts(null)).toEqual([]);
    expect(explanationOf({accepted: ['x'], explanation: 'Because.'})).toBe('Because.');
    expect(explanationOf({accepted: ['x']})).toBeNull();
  });
});
