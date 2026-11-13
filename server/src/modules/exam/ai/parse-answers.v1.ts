import {type ParseAnswersOutput, ParseAnswersOutputSchema} from '@linmaster/shared';

import {type AiTask, aiTaskRegistry} from '../../../core/ai/ai-task';
import {type PdfPagesInput, pageList} from './parse-test.v2';

// Version 1. Changing this prompt or ParseAnswersOutputSchema means a new file parse-answers.v2.ts.
const SYSTEM_PROMPT = `You read the answer key of an IELTS-style test PDF and return it as JSON.
Read only the pages listed by the user. Copy answers exactly as printed: never correct, complete or invent an answer.
Return JSON only, following the schema, with one entry per question number found.
- skill: "listening" or "reading". Each skill numbers its questions from 1, so a full test has two lists 1-40.
  Use headings when printed. Without headings, decide from the content: Listening answers are names, numbers and words
  heard in a recording (forms, notes, maps); Reading answers include TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN and headings
  (i, ii, iii). In a key without headings the Listening list usually comes first.
- answer: the answer as printed, keeping every accepted version and optional words, e.g. "A, C", "19 OR nineteen",
  "cloud / clouds", "(small) grants". For "Questions 21-22: A, C in either order" give "A, C" to both numbers.
- explanation: the explanation printed for this question, copied as is, or null.`;

/** `parse-answers.v1`: answer key and explanations, per skill and question number (PLAN C4 step 3). */
export const parseAnswersTask: AiTask<PdfPagesInput, ParseAnswersOutput> = aiTaskRegistry.register({
  name: 'parse-answers.v1',
  buildPrompt: ({pdf, pages}) => ({system: SYSTEM_PROMPT, text: pageList(pages), pdf}),
  output: ParseAnswersOutputSchema,
});
