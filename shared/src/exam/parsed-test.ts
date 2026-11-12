import {z} from 'zod';

import {SkillSchema, TestKindSchema} from './certifications';
import {QuestionKindSchema} from './question-kinds';

/**
 * A structured test as stored in Test → TestSection → Passage → QuestionGroup → Question (PLAN Phần F).
 * Used by the sample test seed (P3-03) and as the target shape of the parse tasks (P3-05).
 * Answers are checked separately with `parseAnswer(kind, answer)` of the question kind registry.
 */

/** One choice: `A` / `iv` and its text. */
export const ChoiceOptionSchema = z.object({key: z.string().trim().min(1).max(10), text: z.string().trim().min(1)});

/** Display block of a group: plain text or a table. `{{n}}` marks the gap of question n. */
export const GroupContentBlockSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('text'), text: z.string().min(1)}),
  z.object({type: z.literal('table'), rows: z.array(z.array(z.string())).min(1)}),
]);

/** Stored in `QuestionGroup.sharedOptions`: option list shared by the group and the layout of notes, tables, summaries. */
export const GroupSharedSchema = z.object({
  /** Heading of the option list, e.g. "List of Headings". */
  optionsTitle: z.string().min(1).optional(),
  options: z.array(ChoiceOptionSchema).optional(),
  content: z.array(GroupContentBlockSchema).optional(),
});

export const ParsedQuestionSchema = z.object({
  number: z.number().int().min(1),
  /** Completion questions mark their gap with `{{blank}}`; may be empty when the group text says everything. */
  prompt: z.string(),
  /** Options of this question only (single choice). */
  options: z.array(ChoiceOptionSchema).nullable(),
  /** Shape depends on the kind; may hold `explanation`. Never sent to a candidate before submitting. */
  answer: z.unknown(),
});

export const ParsedGroupSchema = z.object({
  kind: QuestionKindSchema,
  fromNo: z.number().int().min(1),
  toNo: z.number().int().min(1),
  instructions: z.string().min(1),
  wordLimit: z.number().int().min(1).nullable(),
  shared: GroupSharedSchema.nullable(),
  questions: z.array(ParsedQuestionSchema).min(1),
});

/** Paragraph of a Reading passage (`label` A, B, C…) or a line of a Listening transcript (`label` = speaker). */
export const ParsedParagraphSchema = z.object({label: z.string().min(1).max(40).optional(), text: z.string().min(1)});

export const ParsedPassageSchema = z.object({
  title: z.string().min(1).max(200),
  /** Reading: the passage. Listening: the transcript of the part, or null when the test has none. */
  paragraphs: z.array(ParsedParagraphSchema).nullable(),
  /** Listening: where the part starts in the audio. */
  audioStartSec: z.number().int().min(0).nullable(),
  groups: z.array(ParsedGroupSchema).min(1),
});

export const ParsedSectionSchema = z.object({
  skill: SkillSchema,
  passages: z.array(ParsedPassageSchema).min(1),
});

export const ParsedTestSchema = z.object({
  title: z.string().min(1).max(200),
  kind: TestKindSchema,
  source: z.string().max(300).nullable(),
  sections: z.array(ParsedSectionSchema).min(1),
});

export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;
export type GroupContentBlock = z.infer<typeof GroupContentBlockSchema>;
export type GroupShared = z.infer<typeof GroupSharedSchema>;
export type ParsedQuestion = z.infer<typeof ParsedQuestionSchema>;
export type ParsedGroup = z.infer<typeof ParsedGroupSchema>;
export type ParsedPassage = z.infer<typeof ParsedPassageSchema>;
export type ParsedTest = z.infer<typeof ParsedTestSchema>;

/**
 * Output of the `parse-test.v1` AI task: the test without answers. Fields are nullable rather than optional
 * and the content block is one flat object, so the JSON Schema stays simple enough for Gemini.
 * `buildParsedTest` (server) turns it and the parse-answers output into a ParsedTest.
 */
export const ParseTestOutputSchema = z.object({
  title: z.string().min(1).max(200),
  sections: z.array(
    z.object({
      skill: SkillSchema,
      passages: z.array(
        z.object({
          title: z.string().min(1).max(200),
          /** Reading: passage paragraphs. Listening: transcript lines (label = speaker), or null without a transcript. */
          paragraphs: z.array(z.object({label: z.string().max(40).nullable(), text: z.string().min(1)})).nullable(),
          groups: z.array(
            z.object({
              kind: QuestionKindSchema,
              fromNo: z.number().int().min(1),
              toNo: z.number().int().min(1),
              instructions: z.string().min(1),
              wordLimit: z.number().int().min(1).nullable(),
              optionsTitle: z.string().nullable(),
              options: z.array(ChoiceOptionSchema).nullable(),
              content: z
                .array(
                  z.object({
                    type: z.enum(['text', 'table']),
                    text: z.string().nullable(),
                    rows: z.array(z.array(z.string())).nullable(),
                  }),
                )
                .nullable(),
              questions: z.array(
                z.object({
                  number: z.number().int().min(1),
                  prompt: z.string(),
                  options: z.array(ChoiceOptionSchema).nullable(),
                }),
              ),
            }),
          ),
        }),
      ),
    }),
  ),
});

export type ParseTestOutput = z.infer<typeof ParseTestOutputSchema>;
