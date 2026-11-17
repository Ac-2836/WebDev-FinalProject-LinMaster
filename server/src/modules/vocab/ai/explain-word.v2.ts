import {type WordExplanation, WordExplanationSchema} from '@linmaster/shared';

import {type AiTask, aiTaskRegistry, wrapUserData} from '../../../core/ai/ai-task';

/** Why the first answer was refused; the second call carries it, which also makes its prompt (and cache key) new. */
export type ExplainWordRetry = 'single_word' | 'not_in_sentence';

export interface ExplainWordInput {
  text: string;
  sentence: string;
  /** Which occurrence of `text` in `sentence` is selected, counted from 1; set only when it appears more than once. */
  occurrence?: number;
  title?: string;
  paragraph?: string;
  retry?: ExplainWordRetry;
}

// Version 2 (v1 reduced a selected phrase to one word and knew only the sentence). Changing this prompt or
// WordExplanationSchema means a new file explain-word.v3.ts.
const SYSTEM_PROMPT = `You explain English words and phrases to Vietnamese learners preparing for IELTS, the way a good reader would: by the meaning they have in this text.
First read the document title and the paragraph, if given, to find the topic of the text. Then explain the selected text in that topic (e.g. "regression" in a statistics text is the statistical model, "mô hình hồi quy", not "sự thoái lui").
What to explain:
- The selection is one word: explain that word in context.
- The selection is a meaningful word group (e.g. "give frequent feedback", "online courses"): explain the whole group. Never cut it down to one word.
- The selection is not a meaningful group (e.g. "Teachers who give frequent"): explain the nearest meaningful phrase of the sentence that overlaps the selection (e.g. "give frequent feedback").
- Whatever you explain must be one unbroken part of the sentence, copied exactly as written there, overlapping the selection, at most 6 words.
Return JSON only, following the schema:
- headword: the text you explain, copied exactly from the sentence.
- lemma: the base form in lowercase (e.g. "mitigated" -> "mitigate"); for a phrase, its dictionary form.
- partOfSpeech: one lowercase word for its role in this sentence: noun, verb, adjective, adverb, preposition, conjunction, pronoun, determiner, phrase or idiom. Use phrase for a free word group.
- ipa: British IPA of the lemma between slashes, or null if unsure.
- meaningVi: a short Vietnamese meaning that fits this sentence and topic; for a phrase, the meaning of the whole phrase.
- definitionEn: a short English definition of that same sense, or null.
- usageNote: one short Vietnamese note on how this sense is used (register, grammar pattern), or null.
- collocations: up to 5 common collocations of this sense.
- cefr: the CEFR level (A1 to C2) of this sense, or null if unsure.
- topics: up to 3 lowercase English topic names this sense belongs to (e.g. environment, education), or an empty list.`;

const RETRY_NOTE: Record<ExplainWordRetry, string> = {
  single_word:
    'Your previous answer cut the selection down to one word. Explain the whole selection if it is a meaningful group; otherwise the nearest meaningful phrase of at least two words.',
  not_in_sentence:
    'Your previous headword was not an exact, unbroken part of the sentence that overlaps the selection. Copy it exactly from the sentence.',
};

const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** `explain-word.v2`: meaning of the selected text in its sentence and topic (PLAN C2). Cached per whole input. */
export const explainWordTask: AiTask<ExplainWordInput, WordExplanation> = aiTaskRegistry.register({
  name: 'explain-word.v2',
  buildPrompt: ({text, sentence, occurrence, title, paragraph, retry}) => ({
    system: SYSTEM_PROMPT,
    text: [
      title && wrapUserData('Document title', title),
      paragraph && wrapUserData('Paragraph', paragraph),
      wrapUserData('Selected text', text),
      occurrence &&
        `The selected text is the ${ORDINALS[occurrence] ?? `#${occurrence}`} occurrence of it in the sentence.`,
      wrapUserData('Sentence', sentence),
      retry && RETRY_NOTE[retry],
    ]
      .filter(Boolean)
      .join('\n\n'),
  }),
  output: WordExplanationSchema,
});
