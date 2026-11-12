import {z} from 'zod';

import {type BandStep, IELTS_ACADEMIC_READING_BANDS, IELTS_LISTENING_BANDS} from './band';
import type {QuestionKind} from './question-kinds';

export const SkillSchema = z.enum(['listening', 'reading']);
export const TestKindSchema = z.enum(['reading', 'listening', 'full']);
/** Keys stored in `Test.certification`. */
export const CertificationIdSchema = z.enum(['IELTS_ACADEMIC']);

export type Skill = z.infer<typeof SkillSchema>;
export type TestKind = z.infer<typeof TestKindSchema>;
export type CertificationId = z.infer<typeof CertificationIdSchema>;

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
