import {type ParseTestV2Output, ParseTestV2OutputSchema} from '@linmaster/shared';

import {type AiTask, aiTaskRegistry} from '../../../core/ai/ai-task';

export interface PdfPagesInput {
  pdf: Buffer;
  /** 1-based pages to read, from classify-pages. */
  pages: number[];
}

// Version 2: transcripts moved to parse-transcript.v1. In v1 one long answer (passages, questions and transcript)
// made the model return null for whole transcripts and sometimes for passage text.
// Changing this prompt or ParseTestV2OutputSchema means a new file parse-test.v3.ts.
const SYSTEM_PROMPT = `You convert an IELTS-style test PDF into structured JSON for a computer-based exam room.
Read only the pages listed by the user. Copy all text exactly as printed: never rewrite, summarise, translate or invent.
Do not write answers. Return JSON only, following the schema.

title: the test title, or a short descriptive title.
hasTranscript: true when the listed pages include a Listening transcript (audio script), else false.
sections: one per skill found (listening, reading), Listening first. Each skill numbers its questions from 1.
passages: Reading passages (3) or Listening parts (4), in order.
- title: the passage title, or "Part N" for Listening.
- paragraphs: Reading: EVERY paragraph of the passage, complete and in order, label = its letter (A, B, C...) when the
  passage labels paragraphs, else null. Never leave a Reading passage without its paragraphs.
  Listening: always null (the transcript is read separately).
groups: one per "Questions X-Y" block.
- kind: tfng (TRUE/FALSE/NOT GIVEN), ynng (YES/NO/NOT GIVEN), single_choice (one letter per question, own options),
  multi_choice (choose TWO or more letters from one shared list), matching (headings, information, features, sentence endings,
  or a summary completed with letters from a word list), completion (write words in gaps: notes, form, table, flow-chart,
  sentence, summary without a word list), short_answer (answer a question in words), diagram_label (label a map, plan or diagram).
  Always matching, never single_choice or completion: "Which paragraph contains the following information?" (answer = a
  paragraph letter) and a summary whose gaps are filled with letters from a list of words.
- instructions: the instruction text of the block. wordLimit: "ONE WORD" -> 1, "NO MORE THAN TWO WORDS" -> 2, else null.
- optionsTitle and options: a list shared by the group (headings i, ii...; letters A, B...), key = "i" or "A", text without the key.
- content: the layout of notes, forms, tables, flow-charts and summaries, as text lines (type "text", rows null) and tables
  (type "table", text null, rows of cells). Mark the gap of question n as {{n}}. Null for other kinds.
- questions: one per number. prompt: the statement or question; for completion the line with the gap, written with {{blank}}
  for this question's gap; empty string when the group content says everything (multi_choice). options: own options for
  single_choice, else null.`;

/** Prompt text telling the model which pages to read. */
export function pageList(pages: number[]): string {
  return `Read only these pages of the attached PDF: ${pages.join(', ')}.`;
}

/** Every Reading passage has text and every group has questions; otherwise the gateway retries without caching. */
export function isParsedTestComplete(output: ParseTestV2Output): boolean {
  return output.sections.every(section =>
    section.passages.every(
      passage =>
        (section.skill !== 'reading' || passage.paragraphs?.some(paragraph => paragraph.text.trim())) &&
        passage.groups.every(group => group.questions.length > 0),
    ),
  );
}

/** `parse-test.v2`: passages and questions of a test PDF, without answers or transcripts (PLAN C4 step 3). */
export const parseTestTask: AiTask<PdfPagesInput, ParseTestV2Output> = aiTaskRegistry.register({
  name: 'parse-test.v2',
  buildPrompt: ({pdf, pages}) => ({system: SYSTEM_PROMPT, text: pageList(pages), pdf}),
  output: ParseTestV2OutputSchema,
  isComplete: isParsedTestComplete,
});
