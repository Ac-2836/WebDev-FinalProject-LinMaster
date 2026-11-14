import {
  type ActivityDay,
  type CardState,
  cardStateOf,
  type KindAccuracy,
  MAX_ACTIVITY_DAYS,
  MIN_ANSWERS_FOR_WEAKNESS,
  type StatsActivityQuery,
  type StatsActivityResponse,
  type StatsBandsResponse,
  type StatsOverviewResponse,
  type StatsVocabResponse,
  type StatsWeaknessesResponse,
  type Streak,
} from '@linmaster/shared';

import {AppError} from '../../core/app-error';
import type {ExamStats} from '../exam';
import type {StudyStats} from '../flashcard';
import type {VocabStats} from '../vocab';

/** Public APIs of the other modules; stats never reads their tables itself. */
export interface StatsSources {
  vocab(userId: string): Promise<VocabStats>;
  study(userId: string): Promise<StudyStats>;
  exam(userId: string): Promise<ExamStats>;
  targetBand(userId: string): Promise<number | null>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Vietnam time is UTC+7 all year (no daylight saving), as for the AI quota and the study day.
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const ACTIVITY_DEFAULT_DAYS = 52 * 7;
const VOCAB_WEEKS = 12;
const TOP_TOPICS = 10;

/** Vietnam calendar day of an instant, `YYYY-MM-DD`. */
export function vietnamDay(time: Date): string {
  return new Date(time.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Current streak ends today, or yesterday while today has no activity yet; longest is the best run ever. */
export function streakOf(activeDays: Iterable<string>, today: string): Streak {
  const days = new Set(activeDays);
  let longest = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // not the start of a run
    let length = 1;
    while (days.has(addDays(day, length))) length += 1;
    longest = Math.max(longest, length);
  }
  let current = 0;
  let day = days.has(today) ? today : addDays(today, -1);
  while (days.has(day)) {
    current += 1;
    day = addDays(day, -1);
  }
  return {current, longest};
}

type Counter = Exclude<keyof ActivityDay, 'date' | 'total'>;

function activityDays(vocab: VocabStats, study: StudyStats, exam: ExamStats): Map<string, ActivityDay> {
  const days = new Map<string, ActivityDay>();
  const add = (time: Date, counter: Counter) => {
    const date = vietnamDay(time);
    const day = days.get(date) ?? {date, lookups: 0, savedWords: 0, reviews: 0, attempts: 0, total: 0};
    day[counter] += 1;
    day.total += 1;
    days.set(date, day);
  };
  for (const time of vocab.lookupTimes) add(time, 'lookups');
  for (const entry of vocab.entries) add(entry.createdAt, 'savedWords');
  for (const time of study.reviewTimes) add(time, 'reviews');
  for (const attempt of exam.attempts) add(attempt.submittedAt, 'attempts');
  return days;
}

/** Word state = its best card's state; a word without rated cards is new. */
function wordStates(vocab: VocabStats, study: StudyStats): Map<string, CardState> {
  const best = new Map<string, number>();
  for (const {vocabEntryId, intervalDays} of study.entryIntervals) {
    best.set(vocabEntryId, Math.max(best.get(vocabEntryId) ?? 0, intervalDays));
  }
  return new Map(
    vocab.entries.map(({id}) => {
      const intervalDays = best.get(id);
      return [id, cardStateOf(intervalDays === undefined ? null : {intervalDays})];
    }),
  );
}

function bandsOf(attempts: ExamStats['attempts'], skill: 'listeningBand' | 'readingBand') {
  const bands = attempts.map(attempt => attempt[skill]).filter(band => band !== null);
  return {best: bands.length ? Math.max(...bands) : null, latest: bands.at(-1) ?? null};
}

export function createStatsService(sources: StatsSources, now: () => Date = () => new Date()) {
  return {
    async overview(userId: string): Promise<StatsOverviewResponse> {
      const [vocab, study, exam, targetBand] = await Promise.all([
        sources.vocab(userId),
        sources.study(userId),
        sources.exam(userId),
        sources.targetBand(userId),
      ]);
      const states = wordStates(vocab, study);
      const studyMs =
        study.sessions.reduce((sum, s) => sum + (s.endedAt.getTime() - s.startedAt.getTime()), 0) +
        exam.attempts.reduce((sum, a) => sum + (a.submittedAt.getTime() - a.startedAt.getTime()), 0);
      return {
        testsTaken: exam.attempts.length,
        bands: {listening: bandsOf(exam.attempts, 'listeningBand'), reading: bandsOf(exam.attempts, 'readingBand')},
        targetBand,
        words: vocab.entries.length,
        masteredWords: [...states.values()].filter(state => state === 'mastered').length,
        cardsReviewed: study.reviewTimes.length,
        studyMinutes: Math.floor(Math.max(0, studyMs) / 60_000),
        streak: streakOf(activityDays(vocab, study, exam).keys(), vietnamDay(now())),
      };
    },

    async activity(userId: string, query: StatsActivityQuery): Promise<StatsActivityResponse> {
      const today = vietnamDay(now());
      const to = query.to ?? (query.from ? addDays(query.from, ACTIVITY_DEFAULT_DAYS - 1) : today);
      const from = query.from ?? addDays(to, 1 - ACTIVITY_DEFAULT_DAYS);
      const span = (Date.parse(to) - Date.parse(from)) / DAY_MS + 1;
      if (span < 1 || span > MAX_ACTIVITY_DAYS) {
        throw new AppError(`from must be on or before to, at most ${MAX_ACTIVITY_DAYS} days apart.`, 400);
      }
      const [vocab, study, exam] = await Promise.all([
        sources.vocab(userId),
        sources.study(userId),
        sources.exam(userId),
      ]);
      const all = activityDays(vocab, study, exam);
      const days = [...all.values()].filter(day => day.date >= from && day.date <= to);
      return {
        from,
        to,
        days: days.sort((a, b) => a.date.localeCompare(b.date)),
        streak: streakOf(all.keys(), today),
      };
    },

    async bands(userId: string): Promise<StatsBandsResponse> {
      const [exam, targetBand] = await Promise.all([sources.exam(userId), sources.targetBand(userId)]);
      return {
        targetBand,
        points: exam.attempts.map(attempt => ({
          attemptId: attempt.id,
          testTitle: attempt.testTitle,
          submittedAt: attempt.submittedAt.toISOString(),
          listening: attempt.listeningBand,
          reading: attempt.readingBand,
        })),
      };
    },

    async vocab(userId: string): Promise<StatsVocabResponse> {
      const [vocab, study] = await Promise.all([sources.vocab(userId), sources.study(userId)]);
      const states: Record<CardState, number> = {new: 0, learning: 0, mastered: 0};
      for (const state of wordStates(vocab, study).values()) states[state] += 1;

      // Weeks start on Monday (Vietnam day); 1970-01-01 was a Thursday, so Monday is day index 4 mod 7.
      const weekStart = (day: string) => addDays(day, -((Date.parse(day) / DAY_MS + 3) % 7));
      const current = weekStart(vietnamDay(now()));
      const weekly = Array.from({length: VOCAB_WEEKS}, (_, index) => ({
        weekStart: addDays(current, (index - VOCAB_WEEKS + 1) * 7),
        added: 0,
      }));
      const topics = new Map<string, number>();
      for (const entry of vocab.entries) {
        const week = weekly.find(item => item.weekStart === weekStart(vietnamDay(entry.createdAt)));
        if (week) week.added += 1;
        for (const topic of entry.topics) topics.set(topic, (topics.get(topic) ?? 0) + 1);
      }
      return {
        total: vocab.entries.length,
        states,
        weekly,
        topics: [...topics]
          .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
          .slice(0, TOP_TOPICS)
          .map(([topic, words]) => ({topic, words})),
      };
    },

    async weaknesses(userId: string): Promise<StatsWeaknessesResponse> {
      const {kinds} = await sources.exam(userId);
      const list: KindAccuracy[] = kinds
        .filter(item => item.answered > 0)
        .map(item => ({...item, accuracy: item.correct / item.answered}))
        .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered);
      const weakest = list.find(item => item.answered >= MIN_ANSWERS_FOR_WEAKNESS);
      return {kinds: list, weakest: weakest ? {skill: weakest.skill, kind: weakest.kind} : null};
    },
  };
}

export type StatsService = ReturnType<typeof createStatsService>;
