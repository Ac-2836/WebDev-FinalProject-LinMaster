import type {ApiModule} from '../../core/module-registry';
import {getEntriesForUser} from '../vocab';
import {prismaFlashcardRepository} from './flashcard.repository';
import type {FlashcardRepository} from './flashcard.repository';
import {createFlashcardRouter} from './flashcard.routes';
import {createFlashcardService} from './flashcard.service';
import type {VocabEntryProvider} from './flashcard.service';
import './flashcard.openapi';

const vocabEntryProvider: VocabEntryProvider = {getEntriesForUser};

export function createFlashcardModule(
  jwtSecret: string,
  repository: FlashcardRepository = prismaFlashcardRepository,
  vocabEntries: VocabEntryProvider = vocabEntryProvider,
): ApiModule {
  const service = createFlashcardService(repository, vocabEntries);
  return {name: 'flashcard', basePath: '/api/v1', router: createFlashcardRouter(service, jwtSecret)};
}

export {createFlashcardService} from './flashcard.service';
export type {FlashcardRepository} from './flashcard.repository';
