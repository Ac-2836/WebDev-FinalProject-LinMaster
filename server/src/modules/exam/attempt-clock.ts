import {type AttemptSectionTime, getCertification, type Skill} from '@linmaster/shared';

// Time of an attempt is decided by the server (PLAN C4): the sections run one after another from `startedAt`.

const SECOND = 1000;

export interface ClockSection {
  id: string;
  skill: Skill;
  /** Time of the section, with its review time (Listening on computer: 2 minutes to check answers). */
  durationSec: number;
}

/** Adds the review time of the certification (`reviewSec`) to the stored duration of every section. */
export function clockSections(certification: string, sections: readonly ClockSection[]): ClockSection[] {
  const spec = getCertification(certification);
  return sections.map(({id, skill, durationSec}) => ({
    id,
    skill,
    durationSec: durationSec + (spec?.sections[skill].reviewSec ?? 0),
  }));
}

/** Time window of every section, in exam order. */
export function sectionTimes(startedAt: Date, sections: readonly ClockSection[]): AttemptSectionTime[] {
  let start = startedAt.getTime();
  return sections.map(section => {
    const startsAt = start;
    start += section.durationSec * SECOND;
    return {
      sectionId: section.id,
      skill: section.skill,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(start).toISOString(),
    };
  });
}

/** `startedAt` + the duration of all sections. */
export function deadlineOf(startedAt: Date, sections: readonly ClockSection[]): Date {
  return new Date(startedAt.getTime() + sections.reduce((sum, section) => sum + section.durationSec, 0) * SECOND);
}

/** Whole seconds left until the deadline, 0 once over. */
export function remainingSec(deadlineAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((deadlineAt.getTime() - now.getTime()) / SECOND));
}

/** The section running at `now`, if any. */
export function currentSection(times: readonly AttemptSectionTime[], now: Date): AttemptSectionTime | undefined {
  const at = now.getTime();
  return times.find(time => Date.parse(time.startsAt) <= at && at < Date.parse(time.endsAt));
}

/**
 * Where the Listening audio is at `now`: it starts with the section and cannot be paused or sought. Once the audio
 * is over (`ended`), the rest of the section is the time to check answers.
 */
export function audioPosition(section: AttemptSectionTime, durationSec: number | null, now: Date) {
  const elapsed = Math.max(0, Math.floor((now.getTime() - Date.parse(section.startsAt)) / SECOND));
  const ended = durationSec !== null && elapsed >= durationSec;
  return {positionSec: ended ? durationSec : elapsed, ended};
}
