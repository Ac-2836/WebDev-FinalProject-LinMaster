import type {AttemptSummary, CandidateSection, CandidateTest} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {attemptsOf, formatScores, perSection, preExamSteps, questionCount} from './intro-logic';

const section = (skill: 'listening' | 'reading', questions: number, hasAudio = false): CandidateSection => ({
  id: skill,
  skill,
  position: 1,
  durationSec: skill === 'listening' ? 1920 : 3600,
  hasAudio,
  passages: [
    {
      id: 'p',
      position: 1,
      title: '',
      paragraphs: null,
      audioStartSec: null,
      groups: [
        {
          id: 'g',
          kind: 'short_answer',
          fromNo: 1,
          toNo: questions,
          instructions: '',
          wordLimit: null,
          shared: null,
          questions: Array.from({length: questions}, (_, i) => ({
            id: `q${i}`,
            number: i + 1,
            prompt: '',
            options: null,
          })),
        },
      ],
    },
  ],
});
const test = (sections: CandidateSection[]) => ({sections}) as CandidateTest;

const attempt = (id: string, testId: string, status: 'in_progress' | 'submitted') =>
  ({id, testId, status}) as AttemptSummary;

describe('test intro', () => {
  it('shows one number per section', () => {
    const full = test([section('listening', 40), section('reading', 40)]);
    expect(perSection(full, questionCount)).toBe('40 + 40');
    expect(perSection(full, s => s.durationSec / 60)).toBe('32 + 60');
  });

  it('finds the attempt in progress and the submitted ones of this test', () => {
    const list = [
      attempt('a3', 't1', 'in_progress'),
      attempt('a2', 't2', 'submitted'),
      attempt('a1', 't1', 'submitted'),
    ];
    const {inProgress, submitted} = attemptsOf(list, 't1');
    expect(inProgress?.id).toBe('a3');
    expect(submitted.map(a => a.id)).toEqual(['a1']);
  });

  it('formats bands per skill', () => {
    expect(
      formatScores([
        {skill: 'listening', correct: 30, total: 40, band: 7},
        {skill: 'reading', correct: 27, total: 40, band: 6.5},
      ]),
    ).toBe('L 7.0 · R 6.5');
  });

  it('adds the sound check only when the test has audio', () => {
    expect(preExamSteps(test([section('reading', 40)]))).toEqual(['details', 'instructions']);
    expect(preExamSteps(test([section('listening', 40, true)]))).toEqual(['details', 'sound', 'instructions']);
  });
});
