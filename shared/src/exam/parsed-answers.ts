import {z} from 'zod';

import {SkillSchema} from './certifications';

/**
 * Output of the `parse-answers.v1` AI task: the answer key as printed, one entry per question.
 * `skill` tells Listening from Reading answers in a full test, even when the key has no headings.
 */
export const ParseAnswersOutputSchema = z.object({
  answers: z.array(
    z.object({
      skill: SkillSchema,
      number: z.number().int().min(1),
      /** As printed, e.g. `TRUE`, `B`, `A, C`, `19 OR nineteen`, `(small) grants`. */
      answer: z.string().min(1),
      /** Explanation printed with the key, or null. */
      explanation: z.string().nullable(),
    }),
  ),
});

export type ParseAnswersOutput = z.infer<typeof ParseAnswersOutputSchema>;
export type ParsedAnswer = ParseAnswersOutput['answers'][number];
