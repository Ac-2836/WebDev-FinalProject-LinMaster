import type {ApiModule} from '../../core/module-registry';
import {getLibraryTest, listLibraryTests, setLibraryTestVisibility} from '../exam';
import {findLatestCopy, getLibrarySet, listLibrarySets, setLibrarySetVisibility} from '../flashcard';
import {prismaReportRepository} from './library.repository';
import {createLibraryRouter} from './library.routes';
import {createLibraryService, type LibrarySources} from './library.service';
import './library.openapi';

const sources: LibrarySources = {
  sets: {setLibrarySetVisibility, listLibrarySets, getLibrarySet, findLatestCopy},
  tests: {setLibraryTestVisibility, listLibraryTests, getLibraryTest},
  reports: prismaReportRepository,
};

/**
 * Library module (PLAN C5): publish, browse and preview; copying and reports follow. It owns only `Report`; visibility and
 * counters change through the public API of flashcard and exam. Public tests are taken with `POST /attempts`.
 */
export function createLibraryModule(jwtSecret: string, deps: LibrarySources = sources): ApiModule {
  return {name: 'library', basePath: '/api/v1', router: createLibraryRouter(createLibraryService(deps), jwtSecret)};
}

export {createLibraryService, type LibrarySources} from './library.service';
export type {ReportRepository} from './library.repository';
