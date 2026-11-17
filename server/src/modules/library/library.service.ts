import {
  type CreateReportRequest,
  type LibraryCopyResponse,
  type LibraryListResponse,
  type LibraryQuery,
  type LibrarySetPreviewResponse,
  type LibraryTestPreviewResponse,
  type LibraryType,
  type LibraryVisibilityResponse,
  REPORTS_TO_HIDE,
} from '@linmaster/shared';

import {AppError} from '../../core/app-error';
import type * as exam from '../exam';
import type * as flashcard from '../flashcard';
import type {ReportRepository} from './library.repository';

/** Public APIs of flashcard and exam; the library never reads their tables itself (PLAN B2). */
export interface LibrarySources {
  sets: Pick<
    typeof flashcard,
    | 'setLibrarySetVisibility'
    | 'listLibrarySets'
    | 'getLibrarySet'
    | 'findLatestCopy'
    | 'copyLibrarySet'
    | 'findSetOwner'
    | 'hideLibrarySet'
  >;
  tests: Pick<
    typeof exam,
    'setLibraryTestVisibility' | 'listLibraryTests' | 'getLibraryTest' | 'findTestOwner' | 'hideLibraryTest'
  >;
  reports: ReportRepository;
}

const notFound = () => new AppError('Content not found.', 404);
const conflict = (message: string, status: string) => new AppError(message, 409, undefined, status);
const VISIBILITY_ERRORS = {
  not_found: notFound,
  hidden: () => conflict('Hidden after reports: unpublish it first, then publish it again.', 'CONTENT_HIDDEN'),
  source_required: () => conflict('Add the source of the test before publishing it.', 'TEST_SOURCE_REQUIRED'),
  empty: () => new AppError('Add at least one card before publishing the set.', 422, undefined, 'SET_EMPTY'),
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
      if (outcome.wasHidden) await reports.resolveOpen(type, id);
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

    async copySet(userId: string, setId: string): Promise<LibraryCopyResponse & {created: boolean}> {
      const outcome = await sets.copyLibrarySet(userId, setId);
      if (outcome.status === 'not_found') throw notFound();
      if (outcome.status !== 'ok') throw conflict('This set is already yours.', 'OWN_CONTENT');
      return {setId: outcome.setId, created: outcome.created};
    },

    /** Reports public content of someone else; the third open report hides it (C5). */
    async report(userId: string, {targetType, targetId, reason, detail}: CreateReportRequest): Promise<void> {
      const target = targetType === 'set' ? await sets.findSetOwner(targetId) : await tests.findTestOwner(targetId);
      if (!target || target.visibility !== 'public') throw notFound();
      if (target.ownerId === userId) throw conflict('You cannot report your own content.', 'OWN_CONTENT');
      const saved = await reports.create({reporterId: userId, targetType, targetId, reason, detail: detail ?? null});
      if (saved.status === 'duplicate') throw conflict('You already reported this content.', 'ALREADY_REPORTED');
      if (saved.openReports < REPORTS_TO_HIDE) return;
      if (targetType === 'set') await sets.hideLibrarySet(targetId);
      else await tests.hideLibraryTest(targetId);
    },
  };
}

export type LibraryService = ReturnType<typeof createLibraryService>;
