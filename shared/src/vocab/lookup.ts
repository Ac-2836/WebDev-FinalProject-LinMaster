import {z} from 'zod';

import {CefrLevelSchema} from './entries';

/** A lookup selects at most 6 words (PLAN C2). */
export const MAX_LOOKUP_WORDS = 6;

export const LookupWordRequestSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine(value => value.split(/\s+/u).length <= MAX_LOOKUP_WORDS, {
        message: `Select at most ${MAX_LOOKUP_WORDS} words.`,
      }),
    sentence: z.string().trim().min(1).max(2000),
    documentId: z.string().uuid().optional(),
    sourceUrl: z.url().max(2048).optional(),
  })
  .strict()
  .refine(input => input.sentence.toLowerCase().includes(input.text.toLowerCase()), {
    message: 'The sentence must contain the selected text.',
    path: ['sentence'],
  });

/**
 * Output of the `explain-word.v1` AI task: the meaning of the selected text in this sentence.
 * Field names match SaveVocabEntrySchema so the client can save it as a word bank entry as is.
 * No transforms here: the gateway turns this schema into the JSON Schema sent to Gemini.
 */
export const WordExplanationSchema = z.object({
  headword: z.string().min(1).max(120),
  lemma: z.string().min(1).max(120),
  partOfSpeech: z.string().min(1).max(20),
  ipa: z.string().max(120).nullable(),
  meaningVi: z.string().min(1),
  definitionEn: z.string().nullable(),
  usageNote: z.string().nullable(),
  collocations: z.array(z.string().min(1)).max(10),
  cefr: CefrLevelSchema.nullable(),
  topics: z.array(z.string().min(1)).max(3),
});

export const LookupWordResponseSchema = z.object({
  explanation: WordExplanationSchema,
  /** Id of the word bank entry with the same lemma and part of speech, or null when not saved yet. */
  savedEntryId: z.string().uuid().nullable(),
});

export type LookupWordRequest = z.infer<typeof LookupWordRequestSchema>;
export type WordExplanation = z.infer<typeof WordExplanationSchema>;
export type LookupWordResponse = z.infer<typeof LookupWordResponseSchema>;
