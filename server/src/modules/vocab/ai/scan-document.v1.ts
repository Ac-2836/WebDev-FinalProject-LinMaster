import {type ScanDocumentOutput, ScanDocumentOutputSchema, type ScanDocumentRequest} from '@linmaster/shared';

import {type AiTask, aiTaskRegistry, wrapUserData} from '../../../core/ai/ai-task';

export interface ScanDocumentInput extends ScanDocumentRequest {
  /** Document text: paragraphs joined by a blank line. */
  text: string;
}

// Version 1. Changing this prompt or ScanDocumentOutputSchema means a new file scan-document.v2.ts.
const SYSTEM_PROMPT = `You help Vietnamese learners preparing for IELTS pick vocabulary worth learning from an English document.
Choose at most 30 words or short phrases from the document that match the requested CEFR levels and topics.
Skip proper names, numbers and very common words (A1-A2) unless A1 or A2 is requested.
Return JSON only, following the schema. For each candidate:
- headword: the word or phrase exactly as written in the sentence.
- lemma: base form in lowercase; partOfSpeech: one lowercase word (noun, verb, adjective, adverb, phrase…).
- meaningVi: a short Vietnamese meaning that fits that sentence.
- cefr: the CEFR level of this sense; topics: up to 3 lowercase English topic names.
- sentence: the full sentence containing the headword, copied character for character from the document. Never rewrite, shorten or invent a sentence.`;

function describeFilters({levels, topics}: ScanDocumentRequest): string {
  const lines = [`CEFR levels: ${levels?.join(', ') ?? 'any level (prefer B2 and above)'}.`];
  lines.push(topics ? wrapUserData('Topics', topics.join(', ')) : 'Topics: any topic.');
  return lines.join('\n');
}

/** `scan-document.v1`: quick filter of a document by CEFR level and topic (PLAN C2). Cached per (text, filters). */
export const scanDocumentTask: AiTask<ScanDocumentInput, ScanDocumentOutput> = aiTaskRegistry.register({
  name: 'scan-document.v1',
  buildPrompt: ({text, levels, topics}) => ({
    system: SYSTEM_PROMPT,
    text: [describeFilters({levels, topics}), wrapUserData('Document', text)].join('\n\n'),
  }),
  output: ScanDocumentOutputSchema,
});
