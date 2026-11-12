import {z} from 'zod';

import type {QuestionKind} from './question-kinds';

export const SkillSchema = z.enum(['listening', 'reading']);
export const TestKindSchema = z.enum(['reading', 'listening', 'full']);
/** Keys stored in `Test.certification`. */
export const CertificationIdSchema = z.enum(['IELTS_ACADEMIC']);

export type Skill = z.infer<typeof SkillSchema>;
export type TestKind = z.infer<typeof TestKindSchema>;
export type CertificationId = z.infer<typeof CertificationIdSchema>;

/** Lowest number of correct answers that earns `band`. Steps are sorted from the highest band down. */
export interface BandStep {
  minCorrect: number;
  band: number;
}

export interface SectionSpec {
  skill: Skill;
  /** Listening parts or Reading passages. */
  parts: number;
  questionCount: number;
  durationSec: number;
  /** Extra time to check answers at the end of the section (Listening on computer: 2 minutes). */
  reviewSec: number;
  questionKinds: readonly QuestionKind[];
  bandTable: readonly BandStep[];
}

export interface Certification {
  id: CertificationId;
  name: string;
  /** Key of the exam room layout in the client registry. */
  layout: string;
  sections: Readonly<Record<Skill, SectionSpec>>;
}

// Raw score → band, IELTS Listening and Academic Reading (40 questions each). Below band 4 the official
// tables stop, so the lower steps follow the usual practice-test conversion.
const LOW_BANDS: BandStep[] = [
  {minCorrect: 8, band: 3.5},
  {minCorrect: 6, band: 3},
  {minCorrect: 4, band: 2.5},
  {minCorrect: 2, band: 2},
  {minCorrect: 1, band: 1},
  {minCorrect: 0, band: 0},
];

const IELTS_LISTENING_BANDS: BandStep[] = [
  {minCorrect: 39, band: 9},
  {minCorrect: 37, band: 8.5},
  {minCorrect: 35, band: 8},
  {minCorrect: 32, band: 7.5},
  {minCorrect: 30, band: 7},
  {minCorrect: 26, band: 6.5},
  {minCorrect: 23, band: 6},
  {minCorrect: 18, band: 5.5},
  {minCorrect: 16, band: 5},
  {minCorrect: 13, band: 4.5},
  {minCorrect: 10, band: 4},
  ...LOW_BANDS,
];

const IELTS_ACADEMIC_READING_BANDS: BandStep[] = [
  {minCorrect: 39, band: 9},
  {minCorrect: 37, band: 8.5},
  {minCorrect: 35, band: 8},
  {minCorrect: 33, band: 7.5},
  {minCorrect: 30, band: 7},
  {minCorrect: 27, band: 6.5},
  {minCorrect: 23, band: 6},
  {minCorrect: 19, band: 5.5},
  {minCorrect: 15, band: 5},
  {minCorrect: 13, band: 4.5},
  {minCorrect: 10, band: 4},
  ...LOW_BANDS,
];

/** Certification registry (PLAN B4, C4): add a certification by adding one entry. */
export const CERTIFICATIONS: Readonly<Record<CertificationId, Certification>> = {
  IELTS_ACADEMIC: {
    id: 'IELTS_ACADEMIC',
    name: 'IELTS Academic',
    layout: 'ielts-cbt',
    sections: {
      listening: {
        skill: 'listening',
        parts: 4,
        questionCount: 40,
        durationSec: 30 * 60,
        reviewSec: 2 * 60,
        questionKinds: ['single_choice', 'multi_choice', 'matching', 'completion', 'short_answer', 'diagram_label'],
        bandTable: IELTS_LISTENING_BANDS,
      },
      reading: {
        skill: 'reading',
        parts: 3,
        questionCount: 40,
        durationSec: 60 * 60,
        reviewSec: 0,
        questionKinds: [
          'single_choice',
          'multi_choice',
          'tfng',
          'ynng',
          'matching',
          'completion',
          'short_answer',
          'diagram_label',
        ],
        bandTable: IELTS_ACADEMIC_READING_BANDS,
      },
    },
  },
};

/** Skills of a test kind in sitting order; a full test is Listening then Reading (TestSection.position). */
const SKILLS_BY_KIND: Readonly<Record<TestKind, readonly Skill[]>> = {
  listening: ['listening'],
  reading: ['reading'],
  full: ['listening', 'reading'],
};

/** Looks up `Test.certification`; unknown keys return `undefined`. */
export function getCertification(id: string): Certification | undefined {
  const parsed = CertificationIdSchema.safeParse(id);
  return parsed.success ? CERTIFICATIONS[parsed.data] : undefined;
}

export function sectionsOf(certification: Certification, kind: TestKind): SectionSpec[] {
  return SKILLS_BY_KIND[kind].map(skill => certification.sections[skill]);
}

/** Time allowed for an attempt (`deadlineAt - startedAt`), including the review time. */
export function attemptDurationSec(certification: Certification, kind: TestKind): number {
  return sectionsOf(certification, kind).reduce((total, section) => total + section.durationSec + section.reviewSec, 0);
}

/** Band for a raw score of one skill. Throws a RangeError for a score outside 0..questionCount. */
export function toBand(certification: Certification, skill: Skill, correct: number): number {
  const section = certification.sections[skill];
  if (!Number.isInteger(correct) || correct < 0 || correct > section.questionCount) {
    throw new RangeError(`Score ${correct} is outside 0..${section.questionCount} for ${skill}.`);
  }
  const step = section.bandTable.find(item => correct >= item.minCorrect);
  return step ? step.band : 0;
}
