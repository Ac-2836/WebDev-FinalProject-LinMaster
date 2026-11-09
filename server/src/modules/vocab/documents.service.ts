import type {CreatePastedDocumentRequest} from '@linmaster/shared';
import type {VocabDocumentRepository} from './documents.repository';
import type {UploadedDocument} from './document-parser';
import {extractDocumentText, titleFromFilename} from './document-parser';
import {normalizeDocumentText} from './document-text';
import {AppError} from '../../core/app-error';

export function createVocabDocumentService(repository: VocabDocumentRepository) {
  return {
    async createPastedDocument(ownerId: string, input: CreatePastedDocumentRequest) {
      const normalized = normalizeDocumentText(input.text);
      const document = await repository.createDocument(ownerId, {
        title: input.title,
        source: 'paste',
        ...normalized,
      });
      return {document};
    },

    async createUploadedDocument(ownerId: string, file: UploadedDocument, title?: string) {
      const extractedText = await extractDocumentText(file);
      const normalized = normalizeDocumentText(extractedText);
      const document = await repository.createDocument(ownerId, {
        title: title?.trim() || titleFromFilename(file.originalName),
        source: 'file',
        ...normalized,
      });
      return {document};
    },

    async listDocuments(ownerId: string) {
      return {documents: await repository.listDocuments(ownerId)};
    },

    async getDocument(ownerId: string, id: string) {
      const document = await repository.findDocument(ownerId, id);
      if (!document) throw new AppError('Document not found.', 404);
      return {document};
    },

    async deleteDocument(ownerId: string, id: string) {
      if (!(await repository.deleteDocument(ownerId, id))) throw new AppError('Document not found.', 404);
      return {deleted: true as const};
    },
  };
}
