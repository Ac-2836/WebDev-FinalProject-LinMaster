import type {CreateExamDocumentRequest, CreatePastedDocumentRequest} from '@linmaster/shared';
import {getPassageText, type PassageText} from '../exam';
import type {VocabDocumentRepository} from './documents.repository';
import type {UploadedDocument} from './document-parser';
import {extractDocumentText, titleFromFilename} from './document-parser';
import {normalizeDocumentText, normalizeParagraphs} from './document-text';
import {AppError} from '../../core/app-error';

function passageError(status: Exclude<PassageText['status'], 'ok'>): AppError {
  if (status === 'forbidden') return new AppError('This attempt belongs to another user.', 403);
  if (status === 'not_submitted') {
    return new AppError('Submit the attempt to open its passages.', 403, undefined, 'ATTEMPT_NOT_SUBMITTED');
  }
  return new AppError('Passage not found.', 404);
}

/** Reads a passage through the public API of exam; vocab never queries exam tables. */
export type PassageReader = (userId: string, attemptId: string, passageId: string) => Promise<PassageText>;

export function createVocabDocumentService(
  repository: VocabDocumentRepository,
  readPassage: PassageReader = getPassageText,
) {
  return {
    /**
     * `POST /vocab/documents/from-exam`: the passage or transcript of a submitted attempt of the user. The same
     * passage again returns the document already made (`created: false`).
     */
    async createExamDocument(ownerId: string, sourceRef: CreateExamDocumentRequest) {
      const existing = await repository.findExamDocument(ownerId, sourceRef);
      if (existing) return {document: existing, created: false};
      const passage = await readPassage(ownerId, sourceRef.attemptId, sourceRef.passageId);
      if (passage.status !== 'ok') throw passageError(passage.status);
      const document = await repository.createDocument(ownerId, {
        title: passage.title,
        source: 'exam',
        sourceRef: {attemptId: sourceRef.attemptId, passageId: sourceRef.passageId},
        ...normalizeParagraphs(passage.paragraphs),
      });
      return {document, created: true};
    },

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
