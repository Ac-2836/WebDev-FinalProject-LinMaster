import type {ApiModule} from '../../core/module-registry';
import {getEntriesForUser} from '../vocab';
import {prismaFlashcardRepository} from './flashcard.repository';
import type {FlashcardRepository} from './flashcard.repository';
import {createFlashcardRouter} from './flashcard.routes';
import {createFlashcardService} from './flashcard.service';
import type {VocabEntryProvider} from './flashcard.service';
import {prismaStudyRepository} from './study.repository';
import type {StudyRepository} from './study.repository';
import {createStudyService} from './study.service';
import './flashcard.openapi';
import './study.openapi';

const vocabEntryProvider: VocabEntryProvider = {getEntriesForUser};

export function createFlashcardModule(
  jwtSecret: string,
  repository: FlashcardRepository = prismaFlashcardRepository,
  vocabEntries: VocabEntryProvider = vocabEntryProvider,
  studyRepository: StudyRepository = prismaStudyRepository,
  now?: () => Date,
): ApiModule {
  const service = createFlashcardService(repository, vocabEntries);
  const study = createStudyService(studyRepository, now);
  return {name: 'flashcard', basePath: '/api/v1', router: createFlashcardRouter(service, study, jwtSecret)};
}

export {createFlashcardService} from './flashcard.service';
export {createStudyService} from './study.service';
export type {FlashcardRepository} from './flashcard.repository';
export type {StudyRepository} from './study.repository';
export {getStudyStats, type StudyStats} from './flashcard.stats';
export {
  copyLibrarySet,
  findLatestCopy,
  findSetOwner,
  getLibrarySet,
  hideLibrarySet,
  listLibrarySets,
  setLibrarySetVisibility,
} from './flashcard.library';
