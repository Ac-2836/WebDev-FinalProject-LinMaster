import type {AttemptSummary, PageLabels, TestSummary} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {pageChips, slotFiles, templateSlots, testProgress} from './upload-logic';

const page = (n: number, labels: PageLabels['labels'], range: [number, number] | null = null): PageLabels => ({
  page: n,
  labels,
  skill: labels.includes('other') || labels.includes('instructions') ? null : 'listening',
  questionRange: range && {from: range[0], to: range[1]},
});

describe('upload', () => {
  it('groups consecutive pages into chips and joins their question numbers', () => {
    const chips = pageChips([
      page(1, ['instructions']),
      page(2, ['questions'], [1, 10]),
      page(3, ['passage', 'questions'], [11, 20]),
      page(4, ['answers'], [1, 25]),
    ]);
    expect(chips).toEqual([
      {from: 1, to: 1, label: 'instructions', skill: null, range: null},
      {from: 2, to: 3, label: 'questions', skill: 'listening', range: {from: 1, to: 20}},
      {from: 4, to: 4, label: 'answers', skill: 'listening', range: {from: 1, to: 25}},
    ]);
  });

  it('lists the boxes of each test kind', () => {
    expect(templateSlots('reading').map(s => s.slot)).toEqual(['test', 'answers', 'explanations']);
    expect(
      templateSlots('full')
        .filter(s => s.required)
        .map(s => s.slot),
    ).toEqual(['test', 'audio', 'answers']);
  });

  it('sends one entry per file with all its boxes, dropping boxes the kind has not', () => {
    expect(slotFiles('reading', {test: 'f1', answers: 'f1', audio: 'f2', explanations: 'f3'})).toEqual([
      {fileId: 'f1', slots: ['test', 'answers']},
      {fileId: 'f3', slots: ['explanations']},
    ]);
  });

  it('tells whether a test is in progress, done or new', () => {
    const test = {id: 't1'} as TestSummary;
    const attempt = (status: 'in_progress' | 'submitted', testId = 't1') =>
      ({testId, status, scores: [{skill: 'reading', correct: 30, total: 40, band: 7}]}) as AttemptSummary;
    expect(testProgress(test, []).state).toBe('new');
    expect(testProgress(test, [attempt('submitted', 't2')]).state).toBe('new');
    expect(testProgress(test, [attempt('submitted')])).toMatchObject({state: 'done'});
    expect(testProgress(test, [attempt('submitted'), attempt('in_progress')]).state).toBe('inProgress');
  });
});
