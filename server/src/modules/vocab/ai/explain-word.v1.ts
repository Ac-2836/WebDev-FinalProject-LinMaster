import {type WordExplanation, WordExplanationSchema} from '@linmaster/shared';

import {type AiTask, aiTaskRegistry, wrapUserData} from '../../../core/ai/ai-task';

export interface ExplainWordInput {
  text: string;
  sentence: string;
}

// Version 1. Changing this prompt or WordExplanationSchema means a new file explain-word.v2.ts.
const SYSTEM_PROMPT = `You are an English dictionary for Vietnamese learners preparing for IELTS.
Explain the selected English word or phrase with the exact meaning it has in the given sentence, not its most common meaning.
Return JSON only, following the schema:
- headword: the selected text exactly as it appears in the sentence.
- lemma: the base form in lowercase (e.g. "mitigated" -> "mitigate"); for a phrase, its dictionary form.
- partOfSpeech: one lowercase word for its role in this sentence: noun, verb, adjective, adverb, preposition, conjunction, pronoun, determiner, phrase or idiom.
- ipa: British IPA of the lemma between slashes, or null if unsure.
- meaningVi: a short Vietnamese meaning that fits this sentence.
- definitionEn: a short English definition of that same sense, or null.
- usageNote: one short Vietnamese note on how this sense is used (register, grammar pattern), or null.
- collocations: up to 5 common collocations of this sense.
- cefr: the CEFR level (A1 to C2) of this sense, or null if unsure.
- topics: up to 3 lowercase English topic names this sense belongs to (e.g. environment, education), or an empty list.`;

/** `explain-word.v1`: meaning of the selected text in its sentence (PLAN C2). Cached forever per (text, sentence). */
export const explainWordTask: AiTask<ExplainWordInput, WordExplanation> = aiTaskRegistry.register({
  name: 'explain-word.v1',
  buildPrompt: ({text, sentence}) => ({
    system: SYSTEM_PROMPT,
    text: [wrapUserData('Selected text', text), wrapUserData('Sentence', sentence)].join('\n\n'),
  }),
  output: WordExplanationSchema,
});
