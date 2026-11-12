import {z} from 'zod';

import {SkillSchema, TestKindSchema} from './certifications';
import {ParsedParagraphSchema} from './parsed-test';
import {GivenAnswerSchema, QuestionKindSchema} from './question-kinds';
import {CandidateTestSchema} from './tests';

// Attempts API (PLAN C4 "API khác"). Time is decided by the server: the client counts down from `remainingSec`.

export const AttemptStatusSchema = z.enum(['in_progress', 'submitted']);

const id = z.string().uuid();
const offset = z.number().int().min(0).max(100_000);

/** A highlighted range of one passage paragraph (`paragraph` = index in `paragraphs`, `start`/`end` = characters). */
export const TextRangeSchema = z
  .object({passageId: id, paragraph: z.number().int().min(0).max(100), start: offset, end: offset})
  .strict()
  .refine(range => range.start < range.end, {message: 'start must be before end.'});

export const AttemptNoteSchema = z
  .object({
    passageId: id,
    paragraph: z.number().int().min(0).max(100),
    start: offset,
    end: offset,
    text: z.string().max(1000),
  })
  .strict()
  .refine(note => note.start < note.end, {message: 'start must be before end.'});

/**
 * What the exam room saves (`Attempt.state`), overwritten by every autosave. Answers and flags are keyed by
 * question id, because question numbers repeat across the sections of a Full test.
 */
export const AttemptStateSchema = z
  .object({
    answers: z
      .record(id, GivenAnswerSchema)
      .refine(answers => Object.keys(answers).length <= 200, {message: 'Too many answers.'}),
    highlights: z.array(TextRangeSchema).max(500),
    notes: z.array(AttemptNoteSchema).max(200),
    /** Questions marked for review. */
    flags: z.array(id).max(200),
    /** Where the candidate was, to reopen the same place after a refresh. */
    position: z.object({sectionId: id, questionId: id.nullable()}).strict().nullable(),
  })
  .strict();

export const EMPTY_ATTEMPT_STATE: AttemptState = {answers: {}, highlights: [], notes: [], flags: [], position: null};

/** Time window of one section; sections follow each other in exam order (Listening before Reading). */
export const AttemptSectionTimeSchema = z.object({
  sectionId: id,
  skill: SkillSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});

/**
 * Listening audio at `serverNow`: the room plays the stream from `positionSec` and cannot pause or seek.
 * Null when no Listening section with audio is running.
 */
export const AttemptAudioSchema = z.object({
  sectionId: id,
  /** Path of the audio stream (P3-08 PR 3), relative to the API base. */
  streamPath: z.string(),
  durationSec: z.number().int().min(0).nullable(),
  positionSec: z.number().int().min(0),
  /** The audio is over; the rest of the section is the time to check answers. */
  ended: z.boolean(),
});

export const AttemptSchema = z.object({
  id,
  testId: id,
  status: AttemptStatusSchema,
  startedAt: z.iso.datetime(),
  deadlineAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  /** Submitted because time ran out. */
  autoSubmitted: z.boolean(),
  /** Clock of the server when the response was built. */
  serverNow: z.iso.datetime(),
  /** Seconds left until `deadlineAt`, 0 once over. */
  remainingSec: z.number().int().min(0),
  /** Section running at `serverNow`; null once over. */
  currentSectionId: id.nullable(),
  sections: z.array(AttemptSectionTimeSchema),
  audio: AttemptAudioSchema.nullable(),
  state: AttemptStateSchema,
  /** The test without answers, explanations or Listening transcripts. */
  test: CandidateTestSchema,
});

export const AttemptIdParamsSchema = z.object({id}).strict();

/** `POST /attempts`: starts a test (own or public); an attempt in progress on the same test is returned instead. */
export const CreateAttemptRequestSchema = z.object({testId: id}).strict();
export const CreateAttemptResponseSchema = z.object({attempt: AttemptSchema});
/** `GET /attempts/:id`: an attempt past its deadline is submitted first (lazy submit). */
export const GetAttemptResponseSchema = z.object({attempt: AttemptSchema});

/** `PUT /attempts/:id/state`: autosave; refused once the deadline passed or the attempt was submitted. */
export const SaveAttemptStateRequestSchema = z.object({state: AttemptStateSchema}).strict();
export const SaveAttemptStateResponseSchema = z.object({
  savedAt: z.iso.datetime(),
  serverNow: z.iso.datetime(),
  remainingSec: z.number().int().min(0),
});

/** Score of one skill; the band comes from the band table of the certification. */
export const SkillScoreSchema = z.object({
  skill: SkillSchema,
  correct: z.number().int().min(0),
  total: z.number().int().min(0),
  band: z.number().min(0).max(9),
});

/** One graded question, from the snapshot taken when grading (`AttemptAnswer`). */
export const ResultQuestionSchema = z.object({
  /** Null when the owner of the test deleted the question afterwards. */
  questionId: id.nullable(),
  number: z.number().int().min(1),
  skill: SkillSchema,
  kind: QuestionKindSchema,
  given: GivenAnswerSchema,
  /** Accepted answers as written in the answer key, e.g. `["TRUE"]`, `["A", "C"]`, `["car park", "parking"]`. */
  correct: z.array(z.string()),
  isCorrect: z.boolean(),
  /** Explanation from the uploaded files, if any. */
  explanation: z.string().nullable(),
});

/** Listening transcript of one part, shown only after submitting. */
export const ResultTranscriptSchema = z.object({
  sectionId: id,
  passageId: id,
  title: z.string(),
  paragraphs: z.array(ParsedParagraphSchema),
});

export const AttemptSummarySchema = z.object({
  id,
  testId: id,
  testTitle: z.string(),
  testKind: TestKindSchema,
  status: AttemptStatusSchema,
  startedAt: z.iso.datetime(),
  deadlineAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  autoSubmitted: z.boolean(),
  /** One entry per skill of the test, empty until submitted. */
  scores: z.array(SkillScoreSchema),
});

export const AttemptResultSchema = AttemptSummarySchema.extend({
  questions: z.array(ResultQuestionSchema),
  transcripts: z.array(ResultTranscriptSchema),
});

/** `POST /attempts/:id/submit`: grades once; calling again returns the same result. */
export const SubmitAttemptResponseSchema = z.object({result: AttemptResultSchema});
/** `GET /attempts/:id/result`: owner only, after submitting. */
export const GetAttemptResultResponseSchema = z.object({result: AttemptResultSchema});
/** `GET /attempts`: attempts of the user, newest first. */
export const ListAttemptsResponseSchema = z.object({attempts: z.array(AttemptSummarySchema)});

/**
 * Module statuses in the error body (`error.status`).
 * - `ATTEMPT_EXPIRED` (409): autosave after the deadline; `GET /attempts/:id` submits the attempt.
 * - `ATTEMPT_SUBMITTED` (409): autosave of an attempt already submitted.
 * - `ATTEMPT_NOT_SUBMITTED` (409): result asked before submitting.
 * - `AUDIO_NOT_AVAILABLE` (409): audio asked outside the running Listening section, or the test has no audio.
 * Other users get 403 on an attempt they do not own.
 */
export const AttemptErrorStatusSchema = z.enum([
  'ATTEMPT_EXPIRED',
  'ATTEMPT_SUBMITTED',
  'ATTEMPT_NOT_SUBMITTED',
  'AUDIO_NOT_AVAILABLE',
]);

export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;
export type TextRange = z.infer<typeof TextRangeSchema>;
export type AttemptNote = z.infer<typeof AttemptNoteSchema>;
export type AttemptState = z.infer<typeof AttemptStateSchema>;
export type AttemptSectionTime = z.infer<typeof AttemptSectionTimeSchema>;
export type AttemptAudio = z.infer<typeof AttemptAudioSchema>;
export type Attempt = z.infer<typeof AttemptSchema>;
export type CreateAttemptRequest = z.infer<typeof CreateAttemptRequestSchema>;
export type SaveAttemptStateRequest = z.infer<typeof SaveAttemptStateRequestSchema>;
export type SaveAttemptStateResponse = z.infer<typeof SaveAttemptStateResponseSchema>;
export type SkillScore = z.infer<typeof SkillScoreSchema>;
export type ResultQuestion = z.infer<typeof ResultQuestionSchema>;
export type ResultTranscript = z.infer<typeof ResultTranscriptSchema>;
export type AttemptSummary = z.infer<typeof AttemptSummarySchema>;
export type AttemptResult = z.infer<typeof AttemptResultSchema>;
export type AttemptErrorStatus = z.infer<typeof AttemptErrorStatusSchema>;
