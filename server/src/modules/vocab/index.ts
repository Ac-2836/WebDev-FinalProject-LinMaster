import type {ApiModule} from '../../core/module-registry';
import {prismaVocabRepository} from './vocab.repository';
import type {VocabRepository} from './vocab.repository';
import {prismaVocabDocumentRepository} from './documents.repository';
import type {VocabDocumentRepository} from './documents.repository';
import {createVocabRouter} from './vocab.routes';
import {createVocabService} from './vocab.service';
import {createVocabDocumentService} from './documents.service';
import {addLookupRoute} from './lookup.routes';
import {addScanRoute} from './scan.routes';
import './vocab.openapi';

export function createVocabModule(
  jwtSecret: string,
  repository: VocabRepository = prismaVocabRepository,
  documentRepository: VocabDocumentRepository = prismaVocabDocumentRepository,
): ApiModule {
  const service = createVocabService(repository);
  const documentService = createVocabDocumentService(documentRepository);
  const router = addLookupRoute(createVocabRouter(service, documentService, jwtSecret), jwtSecret);
  addScanRoute(router, jwtSecret);
  return {name: 'vocab', basePath: '/api/v1', router};
}

export async function getEntriesForUser(userId: string, ids: string[]) {
  return prismaVocabRepository.getEntriesForUser(userId, ids);
}

export async function getDocumentForUser(userId: string, id: string) {
  return prismaVocabDocumentRepository.getDocumentForUser(userId, id);
}

export {createVocabService} from './vocab.service';
export {createVocabDocumentService} from './documents.service';
export type {VocabRepository} from './vocab.repository';
export type {VocabDocumentRepository} from './documents.repository';
