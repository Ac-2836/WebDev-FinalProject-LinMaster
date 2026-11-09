import type {ApiModule} from '../../core/module-registry';
import {prismaVocabRepository} from './vocab.repository';
import type {VocabRepository} from './vocab.repository';
import {createVocabRouter} from './vocab.routes';
import {createVocabService} from './vocab.service';
import './vocab.openapi';

export function createVocabModule(jwtSecret: string, repository: VocabRepository = prismaVocabRepository): ApiModule {
  const service = createVocabService(repository);
  return {name: 'vocab', basePath: '/api/v1', router: createVocabRouter(service, jwtSecret)};
}

export async function getEntriesForUser(userId: string, ids: string[]) {
  return prismaVocabRepository.getEntriesForUser(userId, ids);
}

export {createVocabService} from './vocab.service';
export type {VocabRepository} from './vocab.repository';
