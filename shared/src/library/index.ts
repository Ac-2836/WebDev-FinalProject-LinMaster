import {z} from 'zod';

import {SkillSchema, TestKindSchema} from '../exam/certifications';
import {QuestionKindSchema} from '../exam/question-kinds';
import {TestVisibilitySchema} from '../exam/tests';

// Community library (PLAN C5). Only `public` content is listed or previewed; `private` and `hidden` never are.

/** Open reports that hide a set or a test from the library (C5). */
export const REPORTS_TO_HIDE = 3;
export const MAX_REPORT_DETAIL_LENGTH = 1000;

const count = z.number().int().nonnegative();

/** Kind of content in the library. */
export const LibraryTypeSchema = z.enum(['set', 'test']);
/** `new`: last published first. `popular`: most copies (sets) or attempts (tests) first. */
export const LibrarySortSchema = z.enum(['new', 'popular']);

/** `GET /library`. `skill` only filters tests: a full test matches both skills. */
export const LibraryQuerySchema = z
  .object({
    type: LibraryTypeSchema.default('set'),
    q: z.string().trim().min(1).max(100).optional(),
    skill: SkillSchema.optional(),
    sort: LibrarySortSchema.default('new'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const LibraryAuthorSchema = z.object({id: z.string().uuid(), displayName: z.string()});

export const LibrarySetItemSchema = z.object({
  type: z.literal('set'),
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  termLang: z.string(),
  definitionLang: z.string(),
  cardCount: count,
  copyCount: count,
  author: LibraryAuthorSchema,
  publishedAt: z.iso.datetime(),
});

export const LibraryTestItemSchema = z.object({
  type: z.literal('test'),
  id: z.string().uuid(),
  title: z.string(),
  certification: z.string(),
  kind: TestKindSchema,
  /** Skills in exam order (Listening before Reading). */
  skills: z.array(SkillSchema),
  questionCount: count,
  durationSec: count,
  attemptCount: count,
  author: LibraryAuthorSchema,
  publishedAt: z.iso.datetime(),
});

export const LibraryItemSchema = z.discriminatedUnion('type', [LibrarySetItemSchema, LibraryTestItemSchema]);

export const LibraryListResponseSchema = z.object({
  items: z.array(LibraryItemSchema),
  pagination: z.object({page: count, pageSize: count, total: count, totalPages: count}),
});

/** What the signed-in viewer did with the content, so the preview shows the right buttons (UC42, UC43). */
export const LibraryViewerSchema = z.object({
  isOwner: z.boolean(),
  /** The viewer already reported it. */
  reported: z.boolean(),
});

export const LibraryCardSchema = z.object({
  id: z.string().uuid(),
  position: count,
  term: z.string(),
  definition: z.string(),
  example: z.string().nullable(),
});

/** `GET /library/sets/:id`: the whole set (C5). */
export const LibrarySetPreviewResponseSchema = z.object({
  set: LibrarySetItemSchema.extend({cards: z.array(LibraryCardSchema)}),
  viewer: LibraryViewerSchema.extend({
    /** Newest copy of this set in the viewer's library, so the client can offer to open it (UC43 1a). */
    copiedSetId: z.string().uuid().nullable(),
  }),
});

/** `GET /library/tests/:id`: never the questions or the answers (C5); the test is taken with `POST /attempts`. */
export const LibraryTestPreviewResponseSchema = z.object({
  test: LibraryTestItemSchema.extend({
    source: z.string().nullable(),
    /** Distinct question kinds, e.g. `tfng`, `completion`. */
    questionKinds: z.array(QuestionKindSchema),
  }),
  viewer: LibraryViewerSchema,
});

export const LibraryIdParamsSchema = z.object({id: z.string().uuid()}).strict();

/** `POST /library/{sets|tests}/:id/publish` and `.../unpublish` (owner only). */
export const LibraryVisibilityResponseSchema = z.object({
  visibility: TestVisibilitySchema,
  publishedAt: z.iso.datetime().nullable(),
});

/** `POST /library/sets/:id/copy`: the new private set of the viewer. */
export const LibraryCopyResponseSchema = z.object({setId: z.string().uuid()});

export const ReportReasonSchema = z.enum(['wrong_content', 'copyright', 'inappropriate', 'other']);

/** `POST /library/reports`: public content of someone else, once per person. */
export const CreateReportRequestSchema = z
  .object({
    targetType: LibraryTypeSchema,
    targetId: z.string().uuid(),
    reason: ReportReasonSchema,
    detail: z.string().trim().max(MAX_REPORT_DETAIL_LENGTH).nullable().optional(),
  })
  .strict();
export const CreateReportResponseSchema = z.object({reported: z.literal(true)});

/**
 * Module statuses in the error body (`error.status`).
 * - `TEST_SOURCE_REQUIRED` (409): a test needs a source before it is published (UC40 2a).
 * - `CONTENT_HIDDEN` (409): hidden after reports; unpublish it first, which closes the open reports (st-03).
 * - `OWN_CONTENT` (409): copying or reporting your own content.
 * - `ALREADY_REPORTED` (409): one report per person per content.
 */
export const LibraryErrorStatusSchema = z.enum([
  'TEST_SOURCE_REQUIRED',
  'CONTENT_HIDDEN',
  'OWN_CONTENT',
  'ALREADY_REPORTED',
]);

export type LibraryType = z.infer<typeof LibraryTypeSchema>;
export type LibrarySort = z.infer<typeof LibrarySortSchema>;
export type LibraryQuery = z.infer<typeof LibraryQuerySchema>;
export type LibraryAuthor = z.infer<typeof LibraryAuthorSchema>;
export type LibrarySetItem = z.infer<typeof LibrarySetItemSchema>;
export type LibraryTestItem = z.infer<typeof LibraryTestItemSchema>;
export type LibraryItem = z.infer<typeof LibraryItemSchema>;
export type LibraryListResponse = z.infer<typeof LibraryListResponseSchema>;
export type LibraryCard = z.infer<typeof LibraryCardSchema>;
export type LibrarySetPreviewResponse = z.infer<typeof LibrarySetPreviewResponseSchema>;
export type LibraryTestPreviewResponse = z.infer<typeof LibraryTestPreviewResponseSchema>;
export type LibraryVisibilityResponse = z.infer<typeof LibraryVisibilityResponseSchema>;
export type LibraryCopyResponse = z.infer<typeof LibraryCopyResponseSchema>;
export type ReportReason = z.infer<typeof ReportReasonSchema>;
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;
export type LibraryErrorStatus = z.infer<typeof LibraryErrorStatusSchema>;
