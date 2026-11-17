import type {LibrarySort, LibraryTestItem, QuestionKind, Skill, TestVisibility} from '@linmaster/shared';

import {escapeLike} from '../../core/like';
import {getDb} from '../../core/db';
import type {Prisma} from '../../generated/prisma/client';
import {SUMMARY, withSectionSizes} from './tests.repository';

// Public API of exam for the library (PLAN C5): only this file changes `Test.visibility` and `publishedAt`.
// Learners take a public test with `POST /attempts`, which already counts `attemptCount`.

export type TestVisibilityOutcome =
  | {status: 'ok'; visibility: TestVisibility; publishedAt: Date | null; wasHidden: boolean}
  | {status: 'not_found' | 'hidden' | 'source_required'};

export interface LibraryTestPage {
  q?: string;
  skill?: Skill;
  sort: LibrarySort;
  skip: number;
  take: number;
}

export type LibraryTestDetail = LibraryTestItem & {
  ownerId: string;
  source: string | null;
  questionKinds: QuestionKind[];
};

const ITEM = {...SUMMARY, owner: {select: {id: true, displayName: true}}} as const;

type ItemRow = Prisma.TestGetPayload<{select: typeof ITEM}>;

function toItem(row: ItemRow): LibraryTestItem {
  const test = withSectionSizes(row);
  return {
    type: 'test',
    id: test.id,
    title: test.title,
    certification: test.certification,
    kind: test.kind,
    skills: test.sections.map(section => section.skill),
    questionCount: test.sections.reduce((sum, section) => sum + section.questionCount, 0),
    durationSec: test.sections.reduce((sum, section) => sum + section.durationSec, 0),
    attemptCount: test.attemptCount,
    author: test.owner,
    publishedAt: (test.publishedAt ?? test.createdAt).toISOString(),
  };
}

/**
 * Owner only. A test needs a source before it is published (UC40 2a); a `hidden` one is refused until it is
 * unpublished. Publishing twice keeps the first `publishedAt`.
 */
export async function setLibraryTestVisibility(
  ownerId: string,
  testId: string,
  action: 'publish' | 'unpublish',
): Promise<TestVisibilityOutcome> {
  const db = getDb();
  const test = await db.test.findFirst({where: {id: testId, ownerId}, select: {visibility: true, source: true}});
  if (!test) return {status: 'not_found'};
  if (action === 'publish') {
    if (test.visibility === 'hidden') return {status: 'hidden'};
    if (!test.source?.trim()) return {status: 'source_required'};
  }
  const data: Prisma.TestUpdateInput =
    action === 'unpublish'
      ? {visibility: 'private'}
      : test.visibility === 'public'
        ? {}
        : {visibility: 'public', publishedAt: new Date()};
  const updated = await db.test.update({where: {id: testId}, data, select: {visibility: true, publishedAt: true}});
  return {status: 'ok', ...updated, wasHidden: test.visibility === 'hidden'};
}

/** Public tests only, matching the title or source; `skill` keeps the tests with a section of that skill. */
export async function listLibraryTests({q, skill, sort, skip, take}: LibraryTestPage) {
  const where: Prisma.TestWhereInput = {
    visibility: 'public',
    ...(skill && {sections: {some: {skill}}}),
    ...(q && {
      OR: [
        {title: {contains: escapeLike(q), mode: 'insensitive'}},
        {source: {contains: escapeLike(q), mode: 'insensitive'}},
      ],
    }),
  };
  const orderBy: Prisma.TestOrderByWithRelationInput[] =
    sort === 'popular'
      ? [{attemptCount: 'desc'}, {publishedAt: 'desc'}, {id: 'desc'}]
      : [{publishedAt: 'desc'}, {id: 'desc'}];
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.test.findMany({where, orderBy, skip, take, select: ITEM}),
    db.test.count({where}),
  ]);
  return {items: rows.map(toItem), total};
}

/** Summary of a public test: no question, answer or transcript is read. Null when private, hidden or missing. */
export async function getLibraryTest(testId: string): Promise<LibraryTestDetail | null> {
  const db = getDb();
  const test = await db.test.findFirst({where: {id: testId, visibility: 'public'}, select: ITEM});
  if (!test) return null;
  const kinds = await db.questionGroup.findMany({
    where: {passage: {section: {testId}}},
    distinct: ['kind'],
    orderBy: {kind: 'asc'},
    select: {kind: true},
  });
  return {
    ...toItem(test),
    ownerId: test.ownerId,
    source: test.source,
    questionKinds: kinds.map(group => group.kind),
  };
}

/** Owner of a test, whatever its visibility; null when missing. */
export async function findTestOwner(testId: string): Promise<{ownerId: string; visibility: TestVisibility} | null> {
  return getDb().test.findUnique({where: {id: testId}, select: {ownerId: true, visibility: true}});
}

/** Takes a public test out of the library after enough reports (C5). */
export async function hideLibraryTest(testId: string): Promise<void> {
  await getDb().test.updateMany({where: {id: testId, visibility: 'public'}, data: {visibility: 'hidden'}});
}
