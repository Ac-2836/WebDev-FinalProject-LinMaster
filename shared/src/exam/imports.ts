import {z} from 'zod';

import {SkillSchema, TestKindSchema} from './certifications';
import {ChecklistSchema} from './checklist';
import {PageLabelsSchema} from './page-labels';

// Test import API (PLAN C4 "Luồng tải đề", Phần F): upload files one by one, then create one import.

export const MAX_IMPORT_FILES = 10;
export const MAX_IMPORT_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_AUDIO_BYTES = 60 * 1024 * 1024;
/** Uploaded files that no import uses are deleted after this many hours. */
export const IMPORT_FILE_TTL_HOURS = 24;

/**
 * Boxes of the "Theo mẫu" tab. One file can fill several boxes (a paper with the answer key at the end,
 * Phần F). The "AI nhận diện" tab sends no box and relies on page labels.
 */
export const ImportSlotSchema = z.enum(['test', 'answers', 'audio', 'transcript', 'explanations']);
export const ImportSlotsSchema = z
  .array(ImportSlotSchema)
  .min(1)
  .max(ImportSlotSchema.options.length)
  .refine(slots => new Set(slots).size === slots.length, {message: 'Each box can be chosen only once per file.'});
export const ImportFileTypeSchema = z.enum(['pdf', 'audio']);

export const ImportFileSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  type: ImportFileTypeSchema,
  pageCount: z.number().int().positive().nullable(),
  /** Audio only. */
  durationSec: z.number().int().nonnegative().nullable(),
  /** Labels of every page (`classify-pages.v1`); null for audio. */
  pages: z.array(PageLabelsSchema).nullable(),
  /** The file does not look like part of an IELTS test and will be ignored. */
  unused: z.boolean(),
  createdAt: z.iso.datetime(),
});

/** `POST /tests/imports/files`: multipart field `file`, one PDF (≤ 20 MB) or MP3/M4A (≤ 60 MB). */
export const UploadImportFileResponseSchema = z.object({file: ImportFileSchema});
export const ImportFileIdParamsSchema = z.object({fileId: z.string().uuid()}).strict();
export const DeleteImportFileResponseSchema = z.object({deleted: z.literal(true)});

export const CreateImportRequestSchema = z
  .object({
    kind: TestKindSchema,
    files: z
      .array(z.object({fileId: z.string().uuid(), slots: ImportSlotsSchema.optional()}).strict())
      .min(1)
      .max(MAX_IMPORT_FILES)
      .refine(files => new Set(files.map(file => file.fileId)).size === files.length, {
        message: 'Each file can be used only once.',
      }),
  })
  .strict();

/** State diagram st-02. */
export const ImportStatusSchema = z.enum(['queued', 'parsing', 'validating', 'done', 'failed']);

/** One row of `TestImport.errors`: `error` blocks the import (`failed`), `warning` still creates the test. */
export const ImportIssueSchema = z.object({
  severity: z.enum(['error', 'warning']),
  section: SkillSchema.optional(),
  questionNo: z.number().int().min(1).optional(),
  code: z.string(),
  message: z.string(),
});

export const TestImportSchema = z.object({
  id: z.string().uuid(),
  kind: TestKindSchema,
  status: ImportStatusSchema,
  errors: z.array(ImportIssueSchema),
  /** Set when `status` is `done`. */
  testId: z.string().uuid().nullable(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});

/** `POST /tests/imports` answers 202; poll `GET /tests/imports/:id` every few seconds. */
export const CreateImportResponseSchema = z.object({import: TestImportSchema});
export const ImportIdParamsSchema = z.object({id: z.string().uuid()}).strict();
export const GetImportResponseSchema = z.object({import: TestImportSchema});

/**
 * Module statuses in the error body (`error.status`). The client falls back on the HTTP code for them.
 * - `IMPORT_INCOMPLETE` (422): a required part is missing; `error.details` is `{checklist}`.
 * - `IMPORT_FILE_IN_USE` (409): the file already belongs to an import.
 */
export const ImportErrorStatusSchema = z.enum(['IMPORT_INCOMPLETE', 'IMPORT_FILE_IN_USE']);
export const ImportIncompleteDetailsSchema = z.object({checklist: ChecklistSchema});

export type ImportSlot = z.infer<typeof ImportSlotSchema>;
export type ImportFileType = z.infer<typeof ImportFileTypeSchema>;
export type ImportFile = z.infer<typeof ImportFileSchema>;
export type CreateImportRequest = z.infer<typeof CreateImportRequestSchema>;
export type ImportStatus = z.infer<typeof ImportStatusSchema>;
export type ImportIssue = z.infer<typeof ImportIssueSchema>;
export type TestImport = z.infer<typeof TestImportSchema>;
export type ImportErrorStatus = z.infer<typeof ImportErrorStatusSchema>;
