import {type ClassifyPagesOutput, ClassifyPagesOutputSchema} from '@linmaster/shared';

import {type AiTask, aiTaskRegistry} from '../../../core/ai/ai-task';

// Version 1. Changing this prompt or ClassifyPagesOutputSchema means a new file classify-pages.v2.ts.
const SYSTEM_PROMPT = `You label the pages of a PDF uploaded to an IELTS practice app. The PDF may hold a whole test or only part of it
(questions only, answer key only, transcript only), or be a file that is not a test at all.
Return JSON only, following the schema, with exactly one entry per page in page order (page 1 is the first page).
For each page:
- labels: every kind of content on the page, one or more of:
  - instructions: cover page, general test instructions, "Part 1 / Section 1" headings with no questions yet.
  - passage: Reading passage text (paragraphs, often labelled A, B, C...).
  - questions: question items, question instructions, option lists, tables, notes or flow-charts with gaps to fill.
  - answers: an answer key listing question numbers with their correct answers.
  - explanations: explanations of why answers are correct.
  - transcript: the Listening audio script.
  - other: anything else, e.g. a menu, an invoice, an unrelated document.
- skill: "listening" or "reading" when the page belongs to that skill, else null.
- questionRange: the lowest and highest question numbers shown on the page (questions, answers or explanations), else null.
In a full test, Listening and Reading are each numbered 1-40; give the numbers as printed.
Use the page content only. A file that is not an IELTS test has every page labelled other with skill null.`;

const USER_PROMPT = 'Label every page of the attached PDF.';

/** `classify-pages.v1`: labels each page of a test PDF (PLAN C4 step 1). Cached forever by the PDF content. */
export const classifyPagesTask: AiTask<Buffer, ClassifyPagesOutput> = aiTaskRegistry.register({
  name: 'classify-pages.v1',
  buildPrompt: pdf => ({system: SYSTEM_PROMPT, text: USER_PROMPT, pdf}),
  output: ClassifyPagesOutputSchema,
});
