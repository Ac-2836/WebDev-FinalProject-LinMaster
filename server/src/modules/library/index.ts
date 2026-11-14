import type {ApiModule} from '../../core/module-registry';
import {findTestOwner, getLibraryTest, hideLibraryTest, listLibraryTests, setLibraryTestVisibility} from '../exam';
import {
  copyLibrarySet,
  findLatestCopy,
  findSetOwner,
  getLibrarySet,
  hideLibrarySet,
  listLibrarySets,
  setLibrarySetVisibility,
} from '../flashcard';
import {prismaReportRepository} from './library.repository';
import {createLibraryRouter} from './library.routes';
import {createLibraryService, type LibrarySources} from './library.service';
import './library.openapi';

const sources: LibrarySources = {
  sets: {
    setLibrarySetVisibility,
    listLibrarySets,
    getLibrarySet,
    findLatestCopy,
    copyLibrarySet,
    findSetOwner,
    hideLibrarySet,
  },
  tests: {setLibraryTestVisibility, listLibraryTests, getLibraryTest, findTestOwner, hideLibraryTest},
  reports: prismaReportRepository,
};

/**
 * Library module (PLAN C5): publish, browse, preview, copy and report. It owns only `Report`; visibility and
 * counters change through the public API of flashcard and exam. Public tests are taken with `POST /attempts`.
 */
export function createLibraryModule(jwtSecret: string, deps: LibrarySources = sources): ApiModule {
  return {name: 'library', basePath: '/api/v1', router: createLibraryRouter(createLibraryService(deps), jwtSecret)};
}

export {createLibraryService, type LibrarySources} from './library.service';
export type {ReportRepository} from './library.repository';
