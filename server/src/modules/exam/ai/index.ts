import type {ClassifyPagesOutput, PageLabels, ParseAnswersOutput, ParseTestOutput} from '@linmaster/shared';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

import {runJsonTask} from '../../../core/ai/ai-gateway';
import {AppError} from '../../../core/app-error';
import {type ExplainAnswerInput, explainAnswerTask} from './explain-answer.v1';
import {parseAudioTask} from './parse-audio.v2';
import {classifyPagesTask} from './classify-pages.v1';
import {parseAnswersTask} from './parse-answers.v1';
import {parseTestTask} from './parse-test.v2';
import {type OcrPage, outlineFromOcr, parseTestV3Task} from './parse-test.v3';
import {parseTranscriptTask} from './parse-transcript.v1';

// AI tasks of the exam module (KH's part). The import flow of TH calls only the functions exported here.

async function countPdfPages(pdf: Buffer): Promise<number> {
  const loadingTask = getDocument({data: new Uint8Array(pdf), disableFontFace: true});
  try {
    return (await loadingTask.promise).numPages;
  } catch {
    throw new AppError('The uploaded file is not a readable PDF.', 400);
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Makes the AI labels match the real PDF: exactly one entry per page 1..pageCount, in order.
 * A page the AI skipped counts as `other`; extra or repeated pages are dropped.
 */
export function alignPageLabels(output: ClassifyPagesOutput, pageCount: number): PageLabels[] {
  const byPage = new Map<number, PageLabels>();
  for (const entry of output.pages) if (!byPage.has(entry.page)) byPage.set(entry.page, entry);

  return Array.from({length: pageCount}, (_, index) => {
    const page = index + 1;
    const entry = byPage.get(page);
    if (!entry) return {page, labels: ['other'], skill: null, questionRange: null};

    const range = entry.questionRange;
    return {
      page,
      labels: [...new Set(entry.labels)],
      skill: entry.skill,
      questionRange: range && {from: Math.min(range.from, range.to), to: Math.max(range.from, range.to)},
    };
  });
}

/**
 * Labels every page of a test PDF with `classify-pages.v1` (cache by file content, quota per user).
 * Throws AppError 400 for an unreadable PDF, and the AI gateway errors (429, 502, 503).
 */
export async function classifyPages(pdf: Buffer, {userId}: {userId: string}): Promise<PageLabels[]> {
  const pageCount = await countPdfPages(pdf);
  // shortcut: the PDF is sent inline, so files above ~15 MB exceed Gemini's 20 MB request limit; switch to the Files API if that happens.
  const output = await runJsonTask(classifyPagesTask, pdf, {userId});
  return alignPageLabels(output, pageCount);
}

interface ParseOptions {
  /** 1-based pages of `pdf` to read, picked from the classify-pages labels. */
  pages: number[];
  userId: string;
}

function checkPages(pages: number[]): number[] {
  const unique = [...new Set(pages)].sort((a, b) => a - b);
  if (unique.length === 0 || unique.some(page => !Number.isInteger(page) || page < 1)) {
    throw new Error('parse tasks need at least one valid page number.');
  }
  return unique;
}

/**
 * Passages, questions (no answers) and Listening transcripts. Pass the pages labelled instructions, passage,
 * questions and transcript. `parse-test.v2` reads the test; when it reports a transcript, `parse-transcript.v1`
 * reads it in its own call and its lines become the `paragraphs` of the Listening parts, in order.
 */
export async function parseTest(pdf: Buffer, {pages, userId}: ParseOptions): Promise<ParseTestOutput> {
  const input = {pdf, pages: checkPages(pages)};
  const {hasTranscript, ...outline} = await runJsonTask(parseTestTask, input, {userId});
  const listening = outline.sections.find(section => section.skill === 'listening');
  if (!hasTranscript || !listening) return outline;

  const {parts} = await runJsonTask(parseTranscriptTask, {...input, parts: listening.passages.length}, {userId});
  listening.passages.forEach((passage, index) => {
    const lines = parts.find(entry => entry.part === index + 1)?.lines;
    if (lines?.length) passage.paragraphs = lines;
  });
  return outline;
}

/**
 * The same outline as `parseTest`, read from the OCR text of the pages (`parse-test.v3`): the model returns line ranges
 * and short strings, the server cuts the passages, transcripts and instructions out of the OCR text.
 */
export async function parseTestFromText(pages: OcrPage[], {userId}: {userId: string}): Promise<ParseTestOutput> {
  if (pages.length === 0) throw new Error('parseTestFromText needs at least one page of text.');
  return outlineFromOcr(await runJsonTask(parseTestV3Task, {pages}, {userId}), pages);
}

/** Answer key and explanations per skill and question with `parse-answers.v1`. Pass the answers and explanations pages. */
export function parseAnswers(pdf: Buffer, {pages, userId}: ParseOptions): Promise<ParseAnswersOutput> {
  return runJsonTask(parseAnswersTask, {pdf, pages: checkPages(pages)}, {userId});
}

/**
 * Transcript lines of each Listening part, written from the recording (`parse-audio.v2`, P3-18).
 * Only for a test whose files have no transcript. Gateway errors: 429, 502, 503.
 */
export function parseAudio(
  audio: Buffer,
  {mimeType, parts, userId}: {mimeType: string; parts: number; userId: string},
) {
  return runJsonTask(parseAudioTask, {audio, mimeType, parts}, {userId});
}

/** Why the answer key is right, with quotes from the text (`explain-answer.v1`, P4-12). Gateway errors: 429, 502, 503. */
export function explainAnswer(input: ExplainAnswerInput, {userId}: {userId: string}) {
  return runJsonTask(explainAnswerTask, input, {userId});
}

export type {ExplainAnswerInput} from './explain-answer.v1';
export {buildParsedTest, toQuestionAnswer} from './build-parsed-test';
