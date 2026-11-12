import type {AttemptSummary, CandidateSection, CandidateTest, SkillScore} from '@linmaster/shared';

export const SKILL_NAME = {listening: 'Listening', reading: 'Reading'} as const;

export const questionCount = (section: CandidateSection) =>
  section.passages.reduce((sum, p) => sum + p.groups.reduce((n, g) => n + g.questions.length, 0), 0);

/** "40 + 40", "32 + 60": one number per section, in sitting order. */
export const perSection = (test: CandidateTest, value: (s: CandidateSection) => number) =>
  test.sections.map(value).join(' + ');

/** The attempts of this test, newest first, split into the one in progress and the submitted ones. */
export function attemptsOf(attempts: readonly AttemptSummary[], testId: string) {
  const mine = attempts.filter(a => a.testId === testId);
  return {
    inProgress: mine.find(a => a.status === 'in_progress') ?? null,
    submitted: mine.filter(a => a.status === 'submitted'),
  };
}

/** "L 6.5 · R 7.0". */
export const formatScores = (scores: readonly SkillScore[]) =>
  scores.map(s => `${SKILL_NAME[s.skill][0]} ${s.band.toFixed(1)}`).join(' · ');

export type PreExamStep = 'details' | 'sound' | 'instructions';

/** Screens before the room, like the computer-based test: the sound check only when there is audio to hear. */
export const preExamSteps = (test: CandidateTest): PreExamStep[] =>
  test.sections.some(s => s.skill === 'listening' && s.hasAudio)
    ? ['details', 'sound', 'instructions']
    : ['details', 'instructions'];
