import {
  CreatePastedDocumentRequestSchema,
  CreateUploadedDocumentFieldsSchema,
  ListVocabEntriesQuerySchema,
  SaveVocabEntriesRequestSchema,
  UpdateVocabEntryRequestSchema,
  VocabDocumentIdParamsSchema,
  VocabEntryIdParamsSchema,
} from '@linmaster/shared';
import {z} from 'zod';

export const saveVocabEntriesSchema = z.object({body: SaveVocabEntriesRequestSchema});
export const listVocabEntriesSchema = z.object({query: ListVocabEntriesQuerySchema});
export const getVocabEntrySchema = z.object({params: VocabEntryIdParamsSchema});
export const updateVocabEntrySchema = z.object({params: VocabEntryIdParamsSchema, body: UpdateVocabEntryRequestSchema});
export const deleteVocabEntrySchema = z.object({params: VocabEntryIdParamsSchema});
export const createVocabDocumentSchema = z.union([
  z.object({body: CreatePastedDocumentRequestSchema}),
  z.object({body: CreateUploadedDocumentFieldsSchema}),
]);
export const vocabDocumentParamsSchema = z.object({params: VocabDocumentIdParamsSchema});
