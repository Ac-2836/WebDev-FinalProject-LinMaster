import {z} from 'zod';

import {SkillSchema, TestKindSchema} from './certifications';
import {ChecklistSchema} from './checklist';
import {PageLabelsSchema} from './page-labels';

// Test import API (PLAN C4 "Luồng tải đề", Phần F): upload files one by one, then create one import.

export const MAX_IMPORT_FILES = 10;
export const MAX_IMPORT_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_AUDIO_BYTES = 60 * 1024 * 1024;
/**
 * OCR text of a PDF, sent by the browser page by page (PLAN C4: the AI reads this text, never the scan, so it has no
 * long passage to copy). Page numbers are those of the file itself, counted from 1.
 */
export const MAX_IMPORT_TEXT_PAGES = 100;
export const MAX_IMPORT_TEXT_PAGE_CHARS = 12_000;
export const MAX_IMPORT_TEXT_CHARS = 600_000;
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
  /**
   * Labels of every page (`classify-pages.v1`). Null for audio, and for a PDF when the AI is unavailable or out of
   * quota: the "Theo mẫu" tab still works, the "AI nhận diện" tab asks to upload again later.
   */
  pages: z.array(PageLabelsSchema).nullable(),
  /** The file does not look like part of an IELTS test and will be ignored. */
  unused: z.boolean(),
  /** PDF only: the pages whose OCR text was sent with `PUT /tests/imports/files/:fileId/text`, ascending. */
  textPages: z.array(z.number().int().positive()),
  createdAt: z.iso.datetime(),
});

/** `POST /tests/imports/files`: multipart field `file`, one PDF (≤ 20 MB) or MP3/M4A (≤ 60 MB). */
export const UploadImportFileResponseSchema = z.object({file: ImportFileSchema});
export const ImportFileIdParamsSchema = z.object({fileId: z.string().uuid()}).strict();
/** `PUT /tests/imports/files/:fileId/text`: the OCR text of the PDF, replacing what was sent before. */
export const ImportFileTextRequestSchema = z
  .object({
    pages: z
      .array(
        z
          .object({
            page: z.number().int().min(1),
            /** An empty string for a page without recognised text. */
            text: z.string().max(MAX_IMPORT_TEXT_PAGE_CHARS),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_IMPORT_TEXT_PAGES)
      .refine(pages => new Set(pages.map(entry => entry.page)).size === pages.length, {
        message: 'Each page can be sent only once.',
      })
      .refine(pages => pages.reduce((total, entry) => total + entry.text.length, 0) <= MAX_IMPORT_TEXT_CHARS, {
        message: `The text of all pages together can have at most ${MAX_IMPORT_TEXT_CHARS} characters.`,
      }),
  })
  .strict();
export const ImportFileTextResponseSchema = UploadImportFileResponseSchema;
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

/**
 * Codes of `TestImport.errors` written by the import job (PLAN C4 steps 3–4); the client shows a message per code.
 * Blocking errors (`failed`):
 * - `PAGES_MISSING`: no page labelled as questions or as answers in the PDF.
 * - `SECTION_MISSING`: a skill of the test kind was not found.
 * - `QUESTION_COUNT`: a section has another number of questions than the certification (IELTS: 40).
 * - `QUESTION_NUMBERING`: a question number is missing or repeated (`questionNo`).
 * - `KIND_NOT_ALLOWED`: a question kind the skill does not use.
 * - `ANSWER_MISSING`, `ANSWER_INVALID`: no answer, or an answer that does not fit the question kind (`questionNo`).
 * - `MULTI_CHOICE_MISMATCH`: a "Choose TWO" group whose number of questions differs from its number of letters.
 * - `PASSAGE_TEXT_MISSING`: a Reading passage without text.
 * - `AUDIO_MISSING`, `AUDIO_DURATION_UNKNOWN`: Listening without audio, or audio of unknown length.
 * - `IMPORT_JOB_FAILED`: the files could not be read (AI or storage error).
 * Warnings (`done`): `EXPLANATION_MISSING`, `TRANSCRIPT_MISSING`, `TRANSCRIPT_BY_AI` (written by the AI from the audio), `SECTION_IGNORED` (a skill outside the kind).
 */
export const ImportIssueCodeSchema = z.enum([
  'PAGES_MISSING',
  'SECTION_MISSING',
  'QUESTION_COUNT',
  'QUESTION_NUMBERING',
  'KIND_NOT_ALLOWED',
  'ANSWER_MISSING',
  'ANSWER_INVALID',
  'MULTI_CHOICE_MISMATCH',
  'PASSAGE_TEXT_MISSING',
  'AUDIO_MISSING',
  'AUDIO_DURATION_UNKNOWN',
  'IMPORT_JOB_FAILED',
  'EXPLANATION_MISSING',
  'TRANSCRIPT_MISSING',
  'TRANSCRIPT_BY_AI',
  'SECTION_IGNORED',
]);

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
export type ImportFileTextRequest = z.infer<typeof ImportFileTextRequestSchema>;
export type CreateImportRequest = z.infer<typeof CreateImportRequestSchema>;
export type ImportStatus = z.infer<typeof ImportStatusSchema>;
export type ImportIssue = z.infer<typeof ImportIssueSchema>;
export type ImportIssueCode = z.infer<typeof ImportIssueCodeSchema>;
export type TestImport = z.infer<typeof TestImportSchema>;
export type ImportErrorStatus = z.infer<typeof ImportErrorStatusSchema>;
