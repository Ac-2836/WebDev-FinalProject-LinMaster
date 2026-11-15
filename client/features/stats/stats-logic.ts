import type {ActivityDay, BandPoint} from '@linmaster/shared';

const DAY_MS = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

export interface CalendarCell {
  date: string;
  total: number;
  /** 0 (none) to 4 (busiest), relative to the busiest day. */
  level: number;
}

/**
 * Cells of the activity calendar from `from` to `to`, one per day, Monday first: the grid fills column by column
 * (7 rows), so `null` cells pad the first week. The server sends only days with activity.
 */
export function calendarCells(from: string, to: string, days: ActivityDay[]): (CalendarCell | null)[] {
  const totals = new Map(days.map(d => [d.date, d.total]));
  const max = Math.max(0, ...days.map(d => d.total));
  const start = utc(from);
  const pad = (new Date(start).getUTCDay() + 6) % 7;
  const cells: (CalendarCell | null)[] = Array.from({length: pad}, () => null);
  for (let t = start; t <= utc(to); t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    const total = totals.get(date) ?? 0;
    cells.push({date, total, level: total === 0 ? 0 : Math.ceil((total / max) * 4)});
  }
  return cells;
}

/** Ranges of the activity calendar, in months, and the days each covers, ending today. */
export const ACTIVITY_RANGES = {1: 30, 3: 13 * 7, 6: 26 * 7, 12: 52 * 7} as const;
export type ActivityRange = keyof typeof ACTIVITY_RANGES;

/** First day (Vietnam time, `YYYY-MM-DD`) of a range of `days` days ending today. */
export function rangeFrom(now: Date, days: number) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'}).format(
    new Date(now.getTime() - (days - 1) * DAY_MS),
  );
}

export function busiestDay(days: ActivityDay[]) {
  return days.reduce<ActivityDay | null>((best, d) => (!best || d.total > best.total ? d : best), null);
}

export type BandSkill = 'reading' | 'listening';

/** Y range of the band chart: the bands and the target, with half a band of room, inside 0..9. */
export function bandRange(points: BandPoint[], target: number | null) {
  const all = points.flatMap(p => [p.reading, p.listening]).filter((b): b is number => b !== null);
  if (target !== null) all.push(target);
  if (all.length === 0) return {lo: 4, hi: 9};
  const lo = Math.max(0, Math.floor(Math.min(...all) - 0.5));
  const hi = Math.min(9, Math.ceil(Math.max(...all) + 0.5));
  return {lo, hi: hi > lo ? hi : lo + 1};
}

/** First and last band of one skill, for the chart's aria-label; null when the skill was never taken. */
export function bandChange(points: BandPoint[], skill: BandSkill) {
  const bands = points.map(p => p[skill]).filter((b): b is number => b !== null);
  return bands.length ? {first: bands[0], last: bands.at(-1)!} : null;
}
