import type {CandidateTest, ResultTranscript} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {evidenceContext, explainKey, findPrompt, splitEvidence} from './explain-logic';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const test = {
  sections: [
    {
      skill: 'reading',
      passages: [
        {
          id: id(1),
          title: 'Glass',
          paragraphs: [{label: 'A', text: 'Farms grow on roofs.'}, {text: 'Second one.'}],
          groups: [{questions: [{number: 3, prompt: 'The farm is on the {{blank}}.'}]}],
        },
      ],
    },
    {
      skill: 'listening',
      passages: [{id: id(2), title: 'Part 1', paragraphs: null, groups: [{questions: [{number: 3, prompt: 'Heard'}]}]}],
    },
  ],
} as unknown as CandidateTest;
const transcripts = [
  {passageId: id(2), title: 'Part 1', paragraphs: [{label: 'CALLER', text: 'See you Tuesday.'}]},
] as ResultTranscript[];

describe('findPrompt', () => {
  it('finds the question of its skill and shows the gap as a line', () => {
    expect(findPrompt(test, 'reading', 3)).toBe('The farm is on the ____.');
    expect(findPrompt(test, 'listening', 3)).toBe('Heard');
    expect(findPrompt(test, 'reading', 9)).toBeNull();
    expect(findPrompt(null, 'reading', 3)).toBeNull();
  });
});

describe('evidenceContext', () => {
  const base = {start: 0, end: 5, quote: 'x'};
  it('points into a Reading paragraph or a transcript, labelling by letter or position', () => {
    expect(evidenceContext({...base, passageId: id(1), paragraph: 0}, test, transcripts)).toMatchObject({
      title: 'Glass',
      label: 'A',
    });
    expect(evidenceContext({...base, passageId: id(1), paragraph: 1}, test, transcripts)).toMatchObject({label: '2'});
    expect(evidenceContext({...base, passageId: id(2), paragraph: 0}, test, transcripts)).toMatchObject({
      text: 'See you Tuesday.',
    });
  });

  it('is null when the passage or paragraph is missing', () => {
    expect(evidenceContext({...base, passageId: id(9), paragraph: 0}, test, transcripts)).toBeNull();
    expect(evidenceContext({...base, passageId: id(1), paragraph: 7}, test, transcripts)).toBeNull();
  });
});

describe('splitEvidence', () => {
  it('marks the range when it holds the quote', () => {
    expect(splitEvidence('Farms grow on roofs.', {start: 6, end: 10, quote: 'grow'})).toEqual({
      before: 'Farms ',
      mark: 'grow',
      after: ' on roofs.',
    });
  });

  it('falls back to finding the quote, and gives up when it is absent', () => {
    expect(splitEvidence('Farms grow on roofs.', {start: 0, end: 4, quote: 'roofs'})?.before).toBe('Farms grow on ');
    expect(splitEvidence('Farms grow on roofs.', {start: 0, end: 4, quote: 'cellars'})).toBeNull();
  });
});

describe('explainKey', () => {
  it('keeps the two skills of a full test apart', () => {
    expect(explainKey('reading', 2)).not.toBe(explainKey('listening', 2));
  });
});
