import type {QuestionKind, Skill, TestKind, TestVisibility} from '@linmaster/shared';

import {getDb} from '../../core/db';

/** Columns of `Test` shown in lists, with the size of every section. */
export interface TestRow {
  id: string;
  ownerId: string;
  certification: string;
  kind: TestKind;
  title: string;
  source: string | null;
  visibility: TestVisibility;
  publishedAt: Date | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
  sections: {skill: Skill; durationSec: number; questionCount: number}[];
}

/**
 * The content a candidate may see. Answers are never read here; jsonb columns are raw and checked by the service.
 */
export interface TestContentRow extends TestRow {
  content: {
    id: string;
    skill: Skill;
    position: number;
    durationSec: number;
    audioFileId: string | null;
    passages: {
      id: string;
      position: number;
      title: string;
      paragraphs: unknown;
      audioStartSec: number | null;
      groups: {
        id: string;
        kind: QuestionKind;
        fromNo: number;
        toNo: number;
        instructions: string;
        wordLimit: number | null;
        sharedOptions: unknown;
        questions: {id: string; number: number; prompt: string; options: unknown}[];
      }[];
    }[];
  }[];
}

export interface TestUpdate {
  title?: string;
  source?: string | null;
}

export interface TestRepository {
  /** Tests of the user, newest first. */
  listTests(ownerId: string): Promise<TestRow[]>;
  /** Any test, whoever owns it; the service checks who may see it. */
  findTestContent(testId: string): Promise<TestContentRow | null>;
  /** Null when the test does not belong to the user. */
  updateTest(ownerId: string, testId: string, data: TestUpdate): Promise<TestRow | null>;
  /** Deletes the test only while no other learner took it (`attemptCount` = 0). */
  deleteTest(ownerId: string, testId: string): Promise<'deleted' | 'missing' | 'has_attempts'>;
}

export const SUMMARY = {
  id: true,
  ownerId: true,
  certification: true,
  kind: true,
  title: true,
  source: true,
  visibility: true,
  publishedAt: true,
  attemptCount: true,
  createdAt: true,
  updatedAt: true,
  sections: {
    orderBy: {position: 'asc'},
    select: {
      skill: true,
      durationSec: true,
      passages: {select: {groups: {select: {_count: {select: {questions: true}}}}}},
    },
  },
} as const;

const ORDERED = {orderBy: {position: 'asc'}} as const;

/** Every column a candidate may see, and nothing else: `Question.answer` is not selected. */
const CONTENT_SECTIONS = {
  ...ORDERED,
  select: {
    id: true,
    skill: true,
    position: true,
    durationSec: true,
    audioFileId: true,
    passages: {
      ...ORDERED,
      select: {
        id: true,
        position: true,
        title: true,
        paragraphs: true,
        audioStartSec: true,
        groups: {
          ...ORDERED,
          select: {
            id: true,
            kind: true,
            fromNo: true,
            toNo: true,
            instructions: true,
            wordLimit: true,
            sharedOptions: true,
            questions: {orderBy: {number: 'asc'}, select: {id: true, number: true, prompt: true, options: true}},
          },
        },
      },
    },
  },
} as const;

type SummarySections = {
  skill: Skill;
  durationSec: number;
  passages: {groups: {_count: {questions: number}}[]}[];
}[];

export function withSectionSizes<T extends {sections: SummarySections}>({sections, ...test}: T) {
  return {
    ...test,
    sections: sections.map(({skill, durationSec, passages}) => ({
      skill,
      durationSec,
      questionCount: passages.reduce(
        (sum, passage) => sum + passage.groups.reduce((total, group) => total + group._count.questions, 0),
        0,
      ),
    })),
  };
}

export const prismaTestRepository: TestRepository = {
  async listTests(ownerId) {
    const tests = await getDb().test.findMany({where: {ownerId}, orderBy: {createdAt: 'desc'}, select: SUMMARY});
    return tests.map(withSectionSizes);
  },

  async findTestContent(testId) {
    const test = await getDb().test.findUnique({
      where: {id: testId},
      select: SUMMARY,
    });
    if (!test) return null;
    const content = await getDb().testSection.findMany({where: {testId}, ...CONTENT_SECTIONS});
    return {...withSectionSizes(test), content};
  },

  async updateTest(ownerId, testId, data) {
    const db = getDb();
    const {count} = await db.test.updateMany({where: {id: testId, ownerId}, data});
    if (count === 0) return null;
    const test = await db.test.findUnique({where: {id: testId}, select: SUMMARY});
    return test && withSectionSizes(test);
  },

  async deleteTest(ownerId, testId) {
    const db = getDb();
    const {count} = await db.test.deleteMany({where: {id: testId, ownerId, attemptCount: 0}});
    if (count > 0) return 'deleted';
    return (await db.test.count({where: {id: testId, ownerId}})) > 0 ? 'has_attempts' : 'missing';
  },
};
