import {z} from 'zod';

import {SkillSchema} from './certifications';

// AI explanation of one answer (PLAN C4, `explain-answer.v1`, P4-12). Reading evidence points into a passage,
// Listening evidence into the transcript of its part; both use the same range shape as the exam room highlights.

export const MAX_EXPLANATION_LENGTH = 2000;
export const MAX_EVIDENCE_PER_EXPLANATION = 3;
export const MAX_QUOTE_LENGTH = 500;

/** What the model returns: `paragraph` is the index in the passage it was shown, `quote` is copied from it. */
export const ExplainAnswerOutputSchema = z.object({
  explanation: z.string().trim().min(1).max(MAX_EXPLANATION_LENGTH),
  evidence: z
    .array(
      z.object({
        paragraph: z.number().int().min(0).max(100),
        quote: z.string().trim().min(1).max(MAX_QUOTE_LENGTH),
      }),
    )
    .max(MAX_EVIDENCE_PER_EXPLANATION),
});

export const ExplainQuestionParamsSchema = z
  .object({
    id: z.string().uuid(),
    /** Question number inside its skill, as on the result page. */
    no: z.coerce.number().int().min(1).max(200),
  })
  .strict();

/** Full tests number Listening and Reading from 1 each, so `skill` tells which one is meant. */
export const ExplainQuestionQuerySchema = z.object({skill: SkillSchema.optional()}).strict();

/** A quote found in the passage: `paragraph`, `start` and `end` (characters) locate it, `quote` is the passage text. */
export const AnswerEvidenceSchema = z.object({
  passageId: z.string().uuid(),
  paragraph: z.number().int().min(0),
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  quote: z.string(),
});

export const QuestionExplanationSchema = z.object({
  number: z.number().int(),
  skill: SkillSchema,
  /** `file`: written in the uploaded answer file. `ai`: generated now or cached; the client shows "Do AI tạo". */
  source: z.enum(['file', 'ai']),
  text: z.string(),
  /** Always empty for `file`. */
  evidence: z.array(AnswerEvidenceSchema),
});

export const ExplainQuestionResponseSchema = z.object({explanation: QuestionExplanationSchema});

export type ExplainAnswerOutput = z.infer<typeof ExplainAnswerOutputSchema>;
export type ExplainQuestionQuery = z.infer<typeof ExplainQuestionQuerySchema>;
export type AnswerEvidence = z.infer<typeof AnswerEvidenceSchema>;
export type QuestionExplanation = z.infer<typeof QuestionExplanationSchema>;
