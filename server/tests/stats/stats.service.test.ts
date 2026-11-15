import {StatsOverviewResponseSchema, StatsVocabResponseSchema} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import type {ExamStats} from '../../src/modules/exam';
import type {StudyStats} from '../../src/modules/flashcard';
import {createStatsService, streakOf, vietnamDay} from '../../src/modules/stats/stats.service';
import type {VocabStats} from '../../src/modules/vocab';

// Saturday 14 Nov 2026, 23:30 in Vietnam.
const NOW = new Date('2026-11-14T16:30:00.000Z');
const at = (iso: string) => new Date(iso);

function service(data: {vocab?: Partial<VocabStats>; study?: Partial<StudyStats>; exam?: Partial<ExamStats>}) {
  return createStatsService(
    {
      vocab: async () => ({lookupTimes: [], entries: [], ...data.vocab}),
      study: async () => ({reviewTimes: [], sessions: [], entryIntervals: [], ...data.study}),
      exam: async () => ({attempts: [], kinds: [], ...data.exam}),
      targetBand: async () => 7.5,
      sets: async () => ({published: 2, copies: 5}),
      tests: async () => ({published: 1, attempts: 3}),
    },
    () => NOW,
  );
}

describe('vietnamDay and streakOf', () => {
  it('counts days in UTC+7', () => {
    expect(vietnamDay(at('2026-11-14T16:59:59.000Z'))).toBe('2026-11-14');
    expect(vietnamDay(at('2026-11-14T17:00:00.000Z'))).toBe('2026-11-15');
  });

  it('keeps the current streak until today ends, and finds the longest run', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-12', '2026-11-13'];
    expect(streakOf(days, '2026-11-14')).toEqual({current: 2, longest: 4});
    expect(streakOf([...days, '2026-11-14'], '2026-11-14')).toEqual({current: 3, longest: 4});
    expect(streakOf(days, '2026-11-15')).toEqual({current: 0, longest: 4});
    expect(streakOf([], '2026-11-14')).toEqual({current: 0, longest: 0});
  });
});

describe('stats service', () => {
  const exam: ExamStats = {
    attempts: [
      {
        id: 'a1',
        testTitle: 'R0',
        startedAt: at('2026-11-10T02:00:00.000Z'),
        submittedAt: at('2026-11-10T03:00:00.000Z'),
        listeningBand: null,
        readingBand: 7,
      },
      {
        id: 'a2',
        testTitle: 'Full',
        startedAt: at('2026-11-13T02:00:00.000Z'),
        submittedAt: at('2026-11-13T02:30:00.000Z'),
        listeningBand: 6.5,
        readingBand: 6,
      },
    ],
    kinds: [
      {skill: 'reading', kind: 'tfng', answered: 6, correct: 3},
      {skill: 'reading', kind: 'matching', answered: 4, correct: 1},
      {skill: 'listening', kind: 'completion', answered: 10, correct: 9},
    ],
  };
  const vocab: VocabStats = {
    lookupTimes: [at('2026-11-13T01:00:00.000Z'), at('2026-11-14T16:00:00.000Z')],
    entries: [
      {id: 'w1', createdAt: at('2026-11-13T01:00:00.000Z'), topics: ['environment', 'science']},
      {id: 'w2', createdAt: at('2026-11-09T00:00:00.000Z'), topics: ['environment']},
      {id: 'w3', createdAt: at('2026-08-01T00:00:00.000Z'), topics: []},
    ],
  };
  const study: StudyStats = {
    reviewTimes: [at('2026-11-12T05:00:00.000Z')],
    sessions: [{startedAt: at('2026-11-12T05:00:00.000Z'), endedAt: at('2026-11-12T05:15:30.000Z')}],
    entryIntervals: [
      {vocabEntryId: 'w1', intervalDays: 1},
      {vocabEntryId: 'w1', intervalDays: 30},
      {vocabEntryId: 'w2', intervalDays: 3},
    ],
  };

  it('sums the overview', async () => {
    const overview = await service({vocab, study, exam}).overview('u');
    expect(StatsOverviewResponseSchema.parse(overview)).toEqual({
      testsTaken: 2,
      bands: {listening: {best: 6.5, latest: 6.5}, reading: {best: 7, latest: 6}},
      targetBand: 7.5,
      words: 3,
      masteredWords: 1,
      cardsReviewed: 1,
      studyMinutes: 105, // 15.5 min of study + 60 + 30 min of tests
      streak: {current: 3, longest: 3}, // 12, 13 and 14 Nov
    });
  });

  it('groups activity per Vietnam day inside the range', async () => {
    const result = await service({vocab, study, exam}).activity('u', {from: '2026-11-12', to: '2026-11-14'});
    expect(result.days).toEqual([
      {date: '2026-11-12', lookups: 0, savedWords: 0, reviews: 1, attempts: 0, total: 1},
      {date: '2026-11-13', lookups: 1, savedWords: 1, reviews: 0, attempts: 1, total: 3},
      {date: '2026-11-14', lookups: 1, savedWords: 0, reviews: 0, attempts: 0, total: 1},
    ]);
    const year = await service({}).activity('u', {});
    expect(year).toMatchObject({from: '2025-11-16', to: '2026-11-14', days: []});
  });

  it('refuses a reversed or too long range', async () => {
    await expect(service({}).activity('u', {from: '2026-11-14', to: '2026-11-13'})).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(service({}).activity('u', {from: '2025-01-01', to: '2026-11-14'})).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('lists vocab growth per Monday week, word states and topics', async () => {
    const result = StatsVocabResponseSchema.parse(await service({vocab, study}).vocab('u'));
    expect(result.weekly).toHaveLength(12);
    // w2 at 07:00 on Monday 9 Nov (Vietnam) and w1 fall in this week; w3 (August) is older than 12 weeks.
    expect(result.weekly.at(-1)).toEqual({weekStart: '2026-11-09', added: 2});
    expect(result.weekly[0].weekStart).toBe('2026-08-24');
    expect(result.weekly.reduce((sum, week) => sum + week.added, 0)).toBe(2);
    expect(result.states).toEqual({new: 1, learning: 1, mastered: 1});
    expect(result.topics).toEqual([
      {topic: 'environment', words: 2},
      {topic: 'science', words: 1},
    ]);
  });

  it('sorts question kinds weakest first and needs 5 answers to name the weakest', async () => {
    const result = await service({exam}).weaknesses('u');
    expect(result.kinds.map(item => [item.kind, item.accuracy])).toEqual([
      ['matching', 0.25],
      ['tfng', 0.5],
      ['completion', 0.9],
    ]);
    expect(result.weakest).toEqual({skill: 'reading', kind: 'tfng'});
  });

  it('maps the community numbers', async () => {
    expect(await service({}).community('u')).toEqual({
      publishedSets: 2,
      setCopies: 5,
      publishedTests: 1,
      testAttempts: 3,
    });
  });

  it('gives a new account zeros and empty lists', async () => {
    const empty = service({});
    expect(await empty.overview('u')).toMatchObject({testsTaken: 0, words: 0, streak: {current: 0, longest: 0}});
    expect(await empty.bands('u')).toEqual({targetBand: 7.5, points: []});
    expect(await empty.weaknesses('u')).toEqual({kinds: [], weakest: null});
    expect((await empty.vocab('u')).weekly.every(week => week.added === 0)).toBe(true);
  });
});
