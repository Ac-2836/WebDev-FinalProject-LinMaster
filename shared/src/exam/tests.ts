import {z} from 'zod';

import {SkillSchema, TestKindSchema} from './certifications';
import {ChoiceOptionSchema, GroupSharedSchema, ParsedParagraphSchema} from './parsed-test';
import {QuestionKindSchema} from './question-kinds';

// Tests API (PLAN C4 "API khác"). The candidate view never holds answers, explanations or Listening transcripts.

/** `hidden`: taken out of the library after enough reports (C5); only the owner still sees it. */
export const TestVisibilitySchema = z.enum(['private', 'public', 'hidden']);

export const TestSummarySchema = z.object({
  id: z.string().uuid(),
  /** Key of the certification registry, e.g. `IELTS_ACADEMIC`. */
  certification: z.string(),
  kind: TestKindSchema,
  title: z.string(),
  source: z.string().nullable(),
  visibility: TestVisibilitySchema,
  publishedAt: z.iso.datetime().nullable(),
  /** Attempts by other learners; a test with attempts cannot be deleted. */
  attemptCount: z.number().int().nonnegative(),
  /** Skills in exam order (Listening before Reading). */
  skills: z.array(SkillSchema),
  questionCount: z.number().int().nonnegative(),
  /** Sum of the section durations. */
  durationSec: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CandidateQuestionSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().min(1),
  /** Completion questions mark the gap with `{{blank}}`. */
  prompt: z.string(),
  options: z.array(ChoiceOptionSchema).nullable(),
});

export const CandidateGroupSchema = z.object({
  id: z.string().uuid(),
  kind: QuestionKindSchema,
  fromNo: z.number().int().min(1),
  toNo: z.number().int().min(1),
  instructions: z.string(),
  wordLimit: z.number().int().min(1).nullable(),
  shared: GroupSharedSchema.nullable(),
  questions: z.array(CandidateQuestionSchema),
});

export const CandidatePassageSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().min(1),
  title: z.string(),
  /** Reading paragraphs (A, B, C…). Always null for Listening: the transcript is shown only after submitting. */
  paragraphs: z.array(ParsedParagraphSchema).nullable(),
  /** Listening: where the part starts in the audio. */
  audioStartSec: z.number().int().min(0).nullable(),
  groups: z.array(CandidateGroupSchema),
});

export const CandidateSectionSchema = z.object({
  id: z.string().uuid(),
  skill: SkillSchema,
  position: z.number().int().min(1),
  durationSec: z.number().int().min(0),
  /** Listening audio exists; it is streamed through the attempt (P3-08), never downloaded. */
  hasAudio: z.boolean(),
  passages: z.array(CandidatePassageSchema),
});

/** What a candidate may see before submitting: questions without answers, explanations or transcripts. */
export const CandidateTestSchema = TestSummarySchema.extend({sections: z.array(CandidateSectionSchema)});

/** `GET /tests`: tests of the user, newest first. */
export const ListTestsResponseSchema = z.object({tests: z.array(TestSummarySchema)});
export const TestIdParamsSchema = z.object({id: z.string().uuid()}).strict();
/** `GET /tests/:id`: the owner, or anyone for a `public` test. */
export const GetTestResponseSchema = z.object({test: CandidateTestSchema});

/** `PATCH /tests/:id` (owner only). */
export const UpdateTestRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    source: z.string().trim().max(300).nullable().optional(),
  })
  .strict()
  .refine(body => body.title !== undefined || body.source !== undefined, {message: 'Send a title or a source.'});
export const UpdateTestResponseSchema = z.object({test: TestSummarySchema});
/** `DELETE /tests/:id` (owner only). */
export const DeleteTestResponseSchema = z.object({deleted: z.literal(true)});

/**
 * Module statuses in the error body (`error.status`).
 * - `TEST_HAS_ATTEMPTS` (409): other learners took the test; unpublish it from the library instead (C5).
 */
export const TestErrorStatusSchema = z.enum(['TEST_HAS_ATTEMPTS']);

export type TestVisibility = z.infer<typeof TestVisibilitySchema>;
export type TestSummary = z.infer<typeof TestSummarySchema>;
export type CandidateQuestion = z.infer<typeof CandidateQuestionSchema>;
export type CandidateGroup = z.infer<typeof CandidateGroupSchema>;
export type CandidatePassage = z.infer<typeof CandidatePassageSchema>;
export type CandidateSection = z.infer<typeof CandidateSectionSchema>;
export type CandidateTest = z.infer<typeof CandidateTestSchema>;
export type UpdateTestRequest = z.infer<typeof UpdateTestRequestSchema>;
export type TestErrorStatus = z.infer<typeof TestErrorStatusSchema>;
