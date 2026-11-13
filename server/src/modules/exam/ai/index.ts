import type {ClassifyPagesOutput, PageLabels, ParseAnswersOutput, ParseTestOutput} from '@linmaster/shared';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

import {runJsonTask} from '../../../core/ai/ai-gateway';
import {AppError} from '../../../core/app-error';
import {classifyPagesTask} from './classify-pages.v1';
import {parseAnswersTask} from './parse-answers.v1';
import {parseTestTask} from './parse-test.v2';
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

/** Answer key and explanations per skill and question with `parse-answers.v1`. Pass the answers and explanations pages. */
export function parseAnswers(pdf: Buffer, {pages, userId}: ParseOptions): Promise<ParseAnswersOutput> {
  return runJsonTask(parseAnswersTask, {pdf, pages: checkPages(pages)}, {userId});
}

export {buildParsedTest, toQuestionAnswer} from './build-parsed-test';
