import {z} from 'zod';

/** What a page of an uploaded test PDF contains (PLAN C4 step 1). */
export const PageLabelSchema = z.enum([
  'instructions',
  'passage',
  'questions',
  'answers',
  'explanations',
  'transcript',
  'other',
]);

export const PageSkillSchema = z.enum(['listening', 'reading']);

/**
 * Labels of one page. A page can hold several parts (e.g. the end of a passage and the first questions),
 * so `labels` is a list; each AI task later reads only the pages carrying its label.
 */
export const PageLabelsSchema = z.object({
  /** 1-based page number in the PDF. */
  page: z.number().int().min(1),
  labels: z.array(PageLabelSchema).min(1),
  /** Skill the page belongs to, or null for a page like a cover or an unrelated file. */
  skill: PageSkillSchema.nullable(),
  /** Question numbers seen on the page (questions, answers, explanations), or null when there are none. */
  questionRange: z.object({from: z.number().int().min(1), to: z.number().int().min(1)}).nullable(),
});

/**
 * Output of the `classify-pages.v1` AI task: one entry per page, in page order.
 * No transforms or large max() here: the gateway turns this schema into the JSON Schema sent to Gemini.
 */
export const ClassifyPagesOutputSchema = z.object({pages: z.array(PageLabelsSchema)});

export type PageLabel = z.infer<typeof PageLabelSchema>;
export type PageSkill = z.infer<typeof PageSkillSchema>;
export type PageLabels = z.infer<typeof PageLabelsSchema>;
export type ClassifyPagesOutput = z.infer<typeof ClassifyPagesOutputSchema>;
