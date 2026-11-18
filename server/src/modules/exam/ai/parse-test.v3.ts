import {type ParseTestOutput, type ParseTestV3Output, ParseTestV3OutputSchema} from '@linmaster/shared';

import {type AiTask, aiTaskRegistry, wrapUserData} from '../../../core/ai/ai-task';

/** OCR text of one page of the test PDF, sent by the browser (page numbers are those of the PDF). */
export interface OcrPage {
  page: number;
  text: string;
}

export interface ParseTestV3Input {
  pages: OcrPage[];
}

// Version 3: reads OCR text instead of the PDF, and gives passages, transcripts and instructions as line ranges.
// v2 made Gemini write the passage out, which it refuses for published text (finishReason RECITATION), so no scanned
// IELTS test could be imported. Changing this prompt or ParseTestV3OutputSchema means a new file parse-test.v4.ts.
const SYSTEM_PROMPT = `You convert the OCR text of an IELTS-style test into structured JSON for a computer-based exam room.
The text is numbered line by line ("L12: ..."); a line "=== page N ===" only marks where a page starts and has no number.
The OCR can contain recognition errors, stray page numbers and headers: ignore them.
NEVER copy long text. Passages, transcripts and instructions are given as line ranges (fromLine, toLine, inclusive, the
numbers shown in the text); the server cuts the text out itself. Only short strings are written by you.
Do not write answers. Return JSON only, following the schema.

title: the test title, or a short descriptive title.
sections: one per skill found (listening, reading), Listening first. Each skill numbers its questions from 1.
passages: Reading passages (3) or Listening parts (4), in order.
- title: the passage title, or "Part N" for Listening.
- paragraphs: ranges of lines, one per paragraph, in order, label = its letter (A, B, C...) when the passage labels
  paragraphs, else null. Reading: EVERY paragraph of the passage; a range holds only the paragraph text (not the title,
  not the questions, not page numbers). Listening: the transcript lines of the part, one range per speaker turn
  (label = speaker or null), or null when the pages hold no transcript.
groups: one per "Questions X-Y" block.
- kind: tfng (TRUE/FALSE/NOT GIVEN), ynng (YES/NO/NOT GIVEN), single_choice (one letter per question, own options),
  multi_choice (choose TWO or more letters from one shared list), matching (headings, information, features, sentence endings,
  or a summary completed with letters from a word list), completion (write words in gaps: notes, form, table, flow-chart,
  sentence, summary without a word list), short_answer (answer a question in words), diagram_label (label a map, plan or diagram).
  Always matching, never single_choice or completion: "Which paragraph contains the following information?" (answer = a
  paragraph letter) and a summary whose gaps are filled with letters from a list of words.
- instructionsFromLine, instructionsToLine: the lines of the instruction text of the block (the "Questions X-Y" line
  and the instruction under it). wordLimit: "ONE WORD" -> 1, "NO MORE THAN TWO WORDS" -> 2, else null.
- optionsTitle and options: a list shared by the group (headings i, ii...; letters A, B...), key = "i" or "A", text without the key.
- content: the layout of notes, forms, tables, flow-charts and summaries, as text lines (type "text", rows null) and tables
  (type "table", text null, rows of cells). Mark the gap of question n as {{n}}. Null for other kinds.
- questions: one per number. prompt: the statement or question, corrected where the OCR is wrong; for completion the line
  with the gap, written with {{blank}} for this question's gap; empty string when the group content says everything
  (multi_choice). options: own options for single_choice, else null.`;

/**
 * Numbers the lines of the OCR pages for the prompt: empty lines are dropped, the rest are L1, L2... over all pages.
 * `lines[n - 1]` is line n; the same function builds the prompt and cuts the answer, so both count alike.
 */
export function numberOcrLines(pages: readonly OcrPage[]): {prompt: string; lines: string[]} {
  const lines: string[] = [];
  const parts: string[] = [];
  for (const {page, text} of [...pages].sort((a, b) => a.page - b.page)) {
    parts.push(`=== page ${page} ===`);
    for (const raw of text.split(/\r?\n/u)) {
      const line = raw.trim();
      if (!line) continue;
      lines.push(line);
      parts.push(`L${lines.length}: ${line}`);
    }
  }
  return {prompt: parts.join('\n'), lines};
}

type Range = {fromLine: number; toLine: number};

/** A range inside the text with its ends in order, or null when it does not touch the text at all. */
function usableRange({fromLine, toLine}: Range, lineCount: number): Range | null {
  const from = Math.max(1, Math.min(fromLine, toLine));
  const to = Math.min(lineCount, Math.max(fromLine, toLine));
  return from <= to ? {fromLine: from, toLine: to} : null;
}

/** Joins printed lines into one text; a word broken by a hyphen at the end of a line is joined again. */
// shortcut: "short-" + "term" at a line end loses its hyphen; fine for reading text, fix when an exam needs it.
export function joinOcrLines(lines: readonly string[]): string {
  return lines.reduce((text, line) => {
    if (!text) return line;
    return /[A-Za-z]-$/u.test(text) && /^[a-z]/u.test(line) ? text.slice(0, -1) + line : `${text} ${line}`;
  }, '');
}

/** Every range stays in the text, Reading passages have paragraphs and groups have questions; else the gateway asks again. */
export function isParseTestV3Complete(output: ParseTestV3Output, {pages}: ParseTestV3Input): boolean {
  const {lines} = numberOcrLines(pages);
  const inside = (range: Range) => usableRange(range, lines.length) !== null;
  return output.sections.every(section =>
    section.passages.every(
      passage =>
        (section.skill !== 'reading' || (passage.paragraphs?.length ?? 0) > 0) &&
        (passage.paragraphs ?? []).every(inside) &&
        passage.groups.every(
          group =>
            group.questions.length > 0 &&
            inside({fromLine: group.instructionsFromLine, toLine: group.instructionsToLine}),
        ),
    ),
  );
}

/** Cuts the text of the ranges out of the OCR lines: the result has the shape of `parse-test.v2`, minus `hasTranscript`. */
export function outlineFromOcr(output: ParseTestV3Output, pages: readonly OcrPage[]): ParseTestOutput {
  const {lines} = numberOcrLines(pages);
  const textOf = (range: Range) => {
    const usable = usableRange(range, lines.length);
    return usable ? joinOcrLines(lines.slice(usable.fromLine - 1, usable.toLine)) : '';
  };
  return {
    title: output.title,
    sections: output.sections.map(section => ({
      skill: section.skill,
      passages: section.passages.map(passage => ({
        title: passage.title,
        paragraphs: passage.paragraphs
          ? passage.paragraphs
              .map(paragraph => ({label: paragraph.label, text: textOf(paragraph)}))
              .filter(paragraph => paragraph.text)
          : null,
        groups: passage.groups.map(({instructionsFromLine, instructionsToLine, ...group}) => ({
          ...group,
          instructions:
            textOf({fromLine: instructionsFromLine, toLine: instructionsToLine}) ||
            `Questions ${group.fromNo}–${group.toNo}`,
        })),
      })),
    })),
  };
}

/** `parse-test.v3`: passages and questions of a test from its OCR text, without answers (PLAN C4 step 3). */
export const parseTestV3Task: AiTask<ParseTestV3Input, ParseTestV3Output> = aiTaskRegistry.register({
  name: 'parse-test.v3',
  buildPrompt: ({pages}) => ({
    system: SYSTEM_PROMPT,
    text: wrapUserData('OCR text of the test pages', numberOcrLines(pages).prompt),
  }),
  output: ParseTestV3OutputSchema,
  isComplete: isParseTestV3Complete,
});
