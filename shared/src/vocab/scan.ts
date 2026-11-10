import {z} from 'zod';

import {CefrLevelSchema} from './entries';

/** Common IELTS topics offered in the quick filter (PLAN C2); learners can also type their own. */
export const VOCAB_TOPICS = [
  'education',
  'environment',
  'technology',
  'health',
  'work',
  'business',
  'economy',
  'society',
  'culture',
  'travel',
  'science',
  'media',
  'government',
  'crime',
  'urban life',
] as const;

/** Body of POST /vocab/documents/:id/scan. Omit both filters to get notable words of any level and topic. */
export const ScanDocumentRequestSchema = z
  .object({
    levels: z.array(CefrLevelSchema).min(1).max(6).optional(),
    topics: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(60)
          .transform(value => value.toLowerCase()),
      )
      .min(1)
      .max(10)
      .optional(),
  })
  .strict();

/**
 * Output of the `scan-document.v1` AI task. `sentence` must be copied from the document;
 * the server drops every candidate whose sentence is not found there.
 * No transforms here: the gateway turns this schema into the JSON Schema sent to Gemini.
 */
export const ScanDocumentOutputSchema = z.object({
  candidates: z.array(
    z.object({
      headword: z.string().min(1).max(120),
      lemma: z.string().min(1).max(120),
      partOfSpeech: z.string().min(1).max(20),
      meaningVi: z.string().min(1),
      cefr: CefrLevelSchema,
      topics: z.array(z.string().min(1)).max(3),
      sentence: z.string().min(1),
    }),
  ),
  // No .max() here: Gemini rejects a large maxItems as too complex; the server keeps at most MAX_SCAN_CANDIDATES.
});

/** Most candidates one scan returns. */
export const MAX_SCAN_CANDIDATES = 30;

/**
 * One word worth learning, with the sentence it came from.
 * startOffset/endOffset locate the headword in the document text (paragraphs joined by a blank line),
 * the same scale as saved contexts, so the client can save it with POST /vocab/entries as is.
 */
export const ScanCandidateSchema = ScanDocumentOutputSchema.shape.candidates.element.extend({
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
});

export const ScanDocumentResponseSchema = z.object({candidates: z.array(ScanCandidateSchema)});

export type ScanDocumentRequest = z.infer<typeof ScanDocumentRequestSchema>;
export type ScanDocumentOutput = z.infer<typeof ScanDocumentOutputSchema>;
export type ScanCandidate = z.infer<typeof ScanCandidateSchema>;
export type ScanDocumentResponse = z.infer<typeof ScanDocumentResponseSchema>;
