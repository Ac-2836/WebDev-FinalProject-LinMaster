import {z} from 'zod';

import {SkillSchema, TestKindSchema} from './certifications';

/** Parts of a test upload shown in the "Độ đầy đủ" table (PLAN C4 step 1, Phần F). */
export const ChecklistPartSchema = z.enum(['questions', 'passages', 'answers', 'audio', 'explanations', 'transcript']);
export const ChecklistStatusSchema = z.enum(['complete', 'partial', 'missing']);

export const QuestionRangeSchema = z.object({from: z.number().int().min(1), to: z.number().int().min(1)});

export const ChecklistItemSchema = z.object({
  part: ChecklistPartSchema,
  /** Skill the row is about; `audio` and `transcript` rows are always Listening. */
  skill: SkillSchema,
  /** Required parts block the import; explanations and transcripts are optional (warnings only). */
  required: z.boolean(),
  status: ChecklistStatusSchema,
  /** Question numbers not found yet, e.g. answers missing for 26–40. Empty for parts without numbers. */
  missing: z.array(QuestionRangeSchema),
});

export const ChecklistSchema = z.object({
  /** Kind the table was built for: the one the learner picked, else `detectedKind`. */
  kind: TestKindSchema.nullable(),
  /** Kind inferred from the skills found in the files, which the learner can change (Phần F). */
  detectedKind: TestKindSchema.nullable(),
  items: z.array(ChecklistItemSchema),
  /** Files that do not look like part of a test; they are ignored, not an error. */
  unusedFileIds: z.array(z.string().uuid()),
  /** True when every required row is complete; the "Tạo đề" button is enabled only then. */
  complete: z.boolean(),
});

export type ChecklistPart = z.infer<typeof ChecklistPartSchema>;
export type ChecklistStatus = z.infer<typeof ChecklistStatusSchema>;
export type QuestionRange = z.infer<typeof QuestionRangeSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type Checklist = z.infer<typeof ChecklistSchema>;
