/**
 * Pure logic of the exam room shell (P3-12): server-synced clock, time warnings, question navigation.
 * Question shapes are component-level for now; switch to `shared/src/exam` once P3-08 lands.
 */

export interface RoomPart {
  id: string;
  title: string;
  /** Question numbers in this part, in order (e.g. 14–26). */
  questions: number[];
}

/** Server clock minus device clock, so a wrong device clock cannot add or remove time. */
export const clockOffset = (serverNow: string, deviceNow: number) => Date.parse(serverNow) - deviceNow;

export const remainingMs = (deadlineAt: string, offset: number, deviceNow: number) =>
  Math.max(0, Date.parse(deadlineAt) - (deviceNow + offset));

/** Whole minutes rounded up like the real test ("38 minutes left"); seconds in the last minute. */
export function formatRemaining(ms: number): string {
  if (ms >= 60_000) {
    const min = Math.ceil(ms / 60_000);
    return `${min} ${min === 1 ? 'minute' : 'minutes'} left`;
  }
  const sec = Math.ceil(ms / 1000);
  return `${sec} ${sec === 1 ? 'second' : 'seconds'} left`;
}

export const WARNING_MINUTES = [10, 5] as const;
export type WarningMinute = (typeof WARNING_MINUTES)[number];

/**
 * The warning to show when the clock moves from `prev` to `next` ms left, if it crossed a mark.
 * `prev` is null on the first tick, so opening the room with 7 minutes left does not announce "10 minutes".
 */
export function crossedWarning(prev: number | null, next: number): WarningMinute | null {
  if (prev === null) return null;
  // Smallest mark crossed wins: a jump from 11 to 4 minutes (e.g. after sleep) says "5 minutes".
  const crossed = WARNING_MINUTES.filter(m => prev > m * 60_000 && next <= m * 60_000);
  return crossed.length ? crossed[crossed.length - 1] : null;
}

export const isWarningTime = (ms: number) => ms <= WARNING_MINUTES[0] * 60_000;

export const partOf = (parts: RoomPart[], question: number) => parts.find(p => p.questions.includes(question));

/** The question before or after `current` across parts, or null at either end. */
export function adjacentQuestion(parts: RoomPart[], current: number, dir: -1 | 1): number | null {
  const all = parts.flatMap(p => p.questions);
  const i = all.indexOf(current);
  if (i === -1) return null;
  return all[i + dir] ?? null;
}

export type QuestionState = 'current' | 'answered' | 'unanswered';

export const questionState = (n: number, current: number, answered: ReadonlySet<number>): QuestionState =>
  n === current ? 'current' : answered.has(n) ? 'answered' : 'unanswered';

export const partProgress = (part: RoomPart, answered: ReadonlySet<number>) => ({
  done: part.questions.filter(n => answered.has(n)).length,
  total: part.questions.length,
});

/** Numbers for the submit confirmation. */
export function submitSummary(parts: RoomPart[], answered: ReadonlySet<number>, flagged: ReadonlySet<number>) {
  const all = parts.flatMap(p => p.questions);
  return {
    total: all.length,
    answered: all.filter(n => answered.has(n)).length,
    unanswered: all.filter(n => !answered.has(n)),
    flagged: all.filter(n => flagged.has(n)).length,
  };
}
