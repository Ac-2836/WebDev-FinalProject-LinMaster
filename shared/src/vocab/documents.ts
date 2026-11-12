import {z} from 'zod';

export const VocabDocumentSourceSchema = z.enum(['paste', 'file', 'exam']);

export const VocabDocumentParagraphSchema = z
  .object({label: z.string().trim().min(1).max(40).optional(), text: z.string().trim().min(1)})
  .strict();

export const CreatePastedDocumentRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    text: z
      .string()
      .trim()
      .min(1)
      .max(200_000)
      .refine(value => value.split(/\s+/u).filter(Boolean).length <= 20_000, {
        message: 'A document may contain at most 20,000 words.',
      }),
  })
  .strict();

export const CreateUploadedDocumentFieldsSchema = z
  .object({title: z.string().trim().min(1).max(200).optional()})
  .strict();

export const VocabDocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  source: VocabDocumentSourceSchema,
  paragraphs: z.array(VocabDocumentParagraphSchema),
  wordCount: z.number().int().min(0).max(20_000),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const VocabDocumentListItemSchema = VocabDocumentSchema.omit({paragraphs: true});

export const VocabDocumentDetailSchema = VocabDocumentSchema.extend({
  entries: z.array(
    z.object({
      id: z.string().uuid(),
      headword: z.string(),
      lemma: z.string(),
      contexts: z.array(
        z.object({
          sentence: z.string(),
          startOffset: z.number().int().nullable(),
          endOffset: z.number().int().nullable(),
        }),
      ),
    }),
  ),
});

/**
 * `POST /vocab/documents/from-exam`: a Reading passage or a Listening transcript of an attempt the user submitted
 * becomes a document (source `exam`). The same passage again returns the document already made.
 */
export const CreateExamDocumentRequestSchema = z
  .object({attemptId: z.string().uuid(), passageId: z.string().uuid()})
  .strict();

/**
 * Module statuses in the error body (`error.status`).
 * - `ATTEMPT_NOT_SUBMITTED` (403): the attempt is still in progress; its passages open after submitting.
 */
export const ExamDocumentErrorStatusSchema = z.enum(['ATTEMPT_NOT_SUBMITTED']);

export const CreateVocabDocumentResponseSchema = z.object({document: VocabDocumentSchema});
export const ListVocabDocumentsResponseSchema = z.object({documents: z.array(VocabDocumentListItemSchema)});
export const VocabDocumentIdParamsSchema = z.object({id: z.string().uuid()}).strict();
export const GetVocabDocumentResponseSchema = z.object({document: VocabDocumentDetailSchema});
export const DeleteVocabDocumentResponseSchema = z.object({deleted: z.literal(true)});

export type CreatePastedDocumentRequest = z.infer<typeof CreatePastedDocumentRequestSchema>;
export type CreateExamDocumentRequest = z.infer<typeof CreateExamDocumentRequestSchema>;
export type VocabDocument = z.infer<typeof VocabDocumentSchema>;
export type VocabDocumentDetail = z.infer<typeof VocabDocumentDetailSchema>;
