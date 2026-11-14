import {
  type LibraryListResponse,
  type LibraryQuery,
  type LibrarySetPreviewResponse,
  type LibraryTestPreviewResponse,
  type LibraryType,
  type LibraryVisibilityResponse,
} from '@linmaster/shared';

import {AppError} from '../../core/app-error';
import type * as exam from '../exam';
import type * as flashcard from '../flashcard';
import type {ReportRepository} from './library.repository';

/** Public APIs of flashcard and exam; the library never reads their tables itself (PLAN B2). */
export interface LibrarySources {
  sets: Pick<typeof flashcard, 'setLibrarySetVisibility' | 'listLibrarySets' | 'getLibrarySet' | 'findLatestCopy'>;
  tests: Pick<typeof exam, 'setLibraryTestVisibility' | 'listLibraryTests' | 'getLibraryTest'>;
  reports: ReportRepository;
}

const notFound = () => new AppError('Content not found.', 404);
const conflict = (message: string, status: string) => new AppError(message, 409, undefined, status);
const VISIBILITY_ERRORS = {
  not_found: notFound,
  hidden: () => conflict('Hidden after reports: unpublish it first, then publish it again.', 'CONTENT_HIDDEN'),
  source_required: () => conflict('Add the source of the test before publishing it.', 'TEST_SOURCE_REQUIRED'),
};

export function createLibraryService({sets, tests, reports}: LibrarySources) {
  return {
    async setVisibility(
      userId: string,
      type: LibraryType,
      id: string,
      action: 'publish' | 'unpublish',
    ): Promise<LibraryVisibilityResponse> {
      const outcome =
        type === 'set'
          ? await sets.setLibrarySetVisibility(userId, id, action)
          : await tests.setLibraryTestVisibility(userId, id, action);
      if (outcome.status !== 'ok') throw VISIBILITY_ERRORS[outcome.status]();
      return {visibility: outcome.visibility, publishedAt: outcome.publishedAt?.toISOString() ?? null};
    },

    async browse({type, q, skill, sort, page, pageSize}: LibraryQuery): Promise<LibraryListResponse> {
      const query = {q, sort, skip: (page - 1) * pageSize, take: pageSize};
      const {items, total} =
        type === 'set' ? await sets.listLibrarySets(query) : await tests.listLibraryTests({...query, skill});
      return {items, pagination: {page, pageSize, total, totalPages: Math.ceil(total / pageSize)}};
    },

    async previewSet(userId: string, setId: string): Promise<LibrarySetPreviewResponse> {
      const set = await sets.getLibrarySet(setId);
      if (!set) throw notFound();
      const {ownerId, ...preview} = set;
      const [reported, copiedSetId] = await Promise.all([
        reports.hasReported(userId, 'set', setId),
        sets.findLatestCopy(userId, setId),
      ]);
      return {set: preview, viewer: {isOwner: ownerId === userId, reported, copiedSetId}};
    },

    async previewTest(userId: string, testId: string): Promise<LibraryTestPreviewResponse> {
      const test = await tests.getLibraryTest(testId);
      if (!test) throw notFound();
      const {ownerId, ...preview} = test;
      const reported = await reports.hasReported(userId, 'test', testId);
      return {test: preview, viewer: {isOwner: ownerId === userId, reported}};
    },
  };
}

export type LibraryService = ReturnType<typeof createLibraryService>;
