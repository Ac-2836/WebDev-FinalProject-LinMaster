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
    /** Where `text` starts in `sentence`; tells apart a text that appears more than once in the sentence. */
    textStart: z.number().int().min(0).optional(),
    /** The document the selection comes from, so the AI reads the word in its topic (contextual lookup v2). */
    context: z
      .object({
        title: z.string().trim().max(200).optional(),
        paragraph: z.string().trim().max(3000).optional(),
      })
      .strict()
      .optional(),
    documentId: z.string().uuid().optional(),
    sourceUrl: z.url().max(2048).optional(),
  })
  .strict()
  .refine(input => input.sentence.toLowerCase().includes(input.text.toLowerCase()), {
    message: 'The sentence must contain the selected text.',
    path: ['sentence'],
  })
  .refine(
    ({text, sentence, textStart}) =>
      textStart === undefined ||
      sentence.slice(textStart, textStart + text.length).toLowerCase() === text.toLowerCase(),
    {message: 'textStart must point at the selected text in the sentence.', path: ['textStart']},
  );

/**
 * Output of the `explain-word` AI tasks (v1, v2): the meaning of the selected text in this sentence.
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

/** The text that was really explained, as a range of the request's `sentence`. */
export const LookupMatchSchema = z.object({
  text: z.string().min(1),
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  /** True when the range differs from what the user selected (the AI moved to the nearest meaningful phrase). */
  adjusted: z.boolean(),
});

export const LookupWordResponseSchema = z.object({
  explanation: WordExplanationSchema,
  match: LookupMatchSchema,
  /** Id of the word bank entry with the same lemma and part of speech, or null when not saved yet. */
  savedEntryId: z.string().uuid().nullable(),
});

export type LookupWordRequest = z.infer<typeof LookupWordRequestSchema>;
export type LookupMatch = z.infer<typeof LookupMatchSchema>;
export type WordExplanation = z.infer<typeof WordExplanationSchema>;
export type LookupWordResponse = z.infer<typeof LookupWordResponseSchema>;
