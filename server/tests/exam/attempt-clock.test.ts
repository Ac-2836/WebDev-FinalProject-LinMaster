import {describe, expect, it} from 'vitest';
import {
  audioPosition,
  clockSections,
  currentSection,
  deadlineOf,
  remainingSec,
  sectionTimes,
} from '../../src/modules/exam/attempt-clock';

const START = new Date('2026-11-13T03:00:00.000Z');
const MINUTE = 60_000;
const at = (minutes: number, seconds = 0) => new Date(START.getTime() + minutes * MINUTE + seconds * 1000);
const SECTIONS = [
  {id: 'listening', skill: 'listening' as const, durationSec: 1800},
  {id: 'reading', skill: 'reading' as const, durationSec: 3600},
];

describe('attempt clock', () => {
  it('runs the sections one after another from the start', () => {
    expect(sectionTimes(START, SECTIONS)).toEqual([
      {sectionId: 'listening', skill: 'listening', startsAt: START.toISOString(), endsAt: at(30).toISOString()},
      {sectionId: 'reading', skill: 'reading', startsAt: at(30).toISOString(), endsAt: at(90).toISOString()},
    ]);
    expect(deadlineOf(START, SECTIONS)).toEqual(at(90));
  });

  it('adds the Listening review time of the certification', () => {
    expect(clockSections('IELTS_ACADEMIC', SECTIONS).map(section => section.durationSec)).toEqual([1920, 3600]);
    expect(clockSections('UNKNOWN', SECTIONS).map(section => section.durationSec)).toEqual([1800, 3600]);
  });

  it('counts the whole seconds left, never below 0', () => {
    expect(remainingSec(at(90), START)).toBe(5400);
    expect(remainingSec(at(90), at(89, 59.5))).toBe(1);
    expect(remainingSec(at(90), at(90))).toBe(0);
    expect(remainingSec(at(90), at(120))).toBe(0);
  });

  it('finds the running section, none before the start or after the deadline', () => {
    const times = sectionTimes(START, SECTIONS);
    expect(currentSection(times, START)?.sectionId).toBe('listening');
    expect(currentSection(times, at(29, 59))?.sectionId).toBe('listening');
    expect(currentSection(times, at(30))?.sectionId).toBe('reading');
    expect(currentSection(times, at(90))).toBeUndefined();
    expect(currentSection(times, at(-1))).toBeUndefined();
  });

  it('places the audio by server time and stops it at its end', () => {
    const [listening] = sectionTimes(START, SECTIONS);
    expect(audioPosition(listening, 1680, at(10, 0.9))).toEqual({positionSec: 600, ended: false});
    expect(audioPosition(listening, 1680, at(28))).toEqual({positionSec: 1680, ended: true});
    expect(audioPosition(listening, null, at(29))).toEqual({positionSec: 1740, ended: false});
  });
});
