import type {ActivityDay, BandPoint} from '@linmaster/shared';
import {describe, expect, it} from 'vitest';

import {bandChange, bandRange, busiestDay, calendarCells, rangeFrom} from './stats-logic';

const day = (date: string, total: number) => ({date, total}) as ActivityDay;
const point = (reading: number | null, listening: number | null) => ({reading, listening}) as BandPoint;

describe('stats', () => {
  it('lays out the calendar Monday first, with levels relative to the busiest day', () => {
    // 2026-11-11 is a Wednesday: two padding cells for Monday and Tuesday.
    const cells = calendarCells('2026-11-11', '2026-11-14', [day('2026-11-12', 2), day('2026-11-14', 8)]);
    expect(cells.slice(0, 2)).toEqual([null, null]);
    expect(cells.slice(2).map(c => [c!.date, c!.level])).toEqual([
      ['2026-11-11', 0],
      ['2026-11-12', 1],
      ['2026-11-13', 0],
      ['2026-11-14', 4],
    ]);
    expect(busiestDay([day('2026-11-12', 2), day('2026-11-14', 8)])?.date).toBe('2026-11-14');
    expect(busiestDay([])).toBeNull();
  });

  it('starts a range in Vietnam time', () => {
    // 20:00 UTC on 14/11 is already 15/11 in Vietnam.
    expect(rangeFrom(new Date('2026-11-14T20:00:00Z'), 1)).toBe('2026-11-15');
    expect(rangeFrom(new Date('2026-11-14T20:00:00Z'), 91)).toBe('2026-08-17');
  });

  it('fits the band axis around the bands and the target', () => {
    expect(bandRange([], null)).toEqual({lo: 4, hi: 9});
    expect(bandRange([point(6, 5.5), point(7, null)], 7.5)).toEqual({lo: 5, hi: 8});
    expect(bandChange([point(6, null), point(null, 5), point(7, 6)], 'reading')).toEqual({first: 6, last: 7});
    expect(bandChange([point(6, null)], 'listening')).toBeNull();
  });
});
