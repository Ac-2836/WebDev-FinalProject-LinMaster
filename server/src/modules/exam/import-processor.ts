import {CERTIFICATIONS, type PageLabel, type PageLabels} from '@linmaster/shared';

import {AppError} from '../../core/app-error';
import type {Storage} from '../../core/storage';
import {buildParsedTest, type parseAnswers, type parseAudio, type parseTest, type parseTestFromText} from './ai';
import type {ImportProcessor} from './import-jobs';
import {validateParsedTest} from './import-validator';
import type {ImportRepository} from './imports.repository';
import type {PageLabeler} from './imports.service';
import {readPageText} from './ocr-text';

export interface ImportProcessorDeps {
  repository: ImportRepository;
  storage: Storage;
  /** KH's AI tasks (`./ai`), injected so tests never call the real model. */
  labelPages: PageLabeler;
  parseTest: typeof parseTest;
  /**
   * Reads the test from the OCR text the browser sent (`parse-test.v3`): the AI gets text and returns line ranges, so it
   * has no published passage to write out (RECITATION). Without it, or without text for every page, `parseTest` reads the scan.
   */
  parseTestText?: typeof parseTestFromText;
  parseAnswers: typeof parseAnswers;
  /** Writes the Listening transcript from the audio when the files have none (P3-18); skipped when left out. */
  parseAudio?: typeof parseAudio;
}

/** Pages read by parse-test.v1 and by parse-answers.v1 (PLAN C4 step 3: each task gets only its pages). */
const TEST_LABELS: readonly PageLabel[] = ['instructions', 'passage', 'questions', 'transcript'];
const ANSWER_LABELS: readonly PageLabel[] = ['answers', 'explanations'];

function pagesWith(pages: readonly PageLabels[], labels: readonly PageLabel[]): number[] {
  return pages.filter(page => page.labels.some(label => labels.includes(label))).map(page => page.page);
}

/**
 * The import job (PLAN C4 steps 3–4): labels the pages of the merged PDF (AI cache by content), reads the test
 * and the answer key in parallel, joins them, validates the result and saves a private test. Blocking errors fail
 * the import with issues per question; warnings stay with the new test.
 */
export function createImportProcessor({
  repository,
  storage,
  labelPages,
  parseTest,
  parseTestText,
  parseAnswers,
  parseAudio,
}: ImportProcessorDeps): ImportProcessor {
  return async (job, progress) => {
    const userId = job.ownerId;
    const file = await repository.findFile(userId, job.questionFileId);
    const pdf = file && (await storage.get(file.storageKey));
    if (!pdf) throw new AppError('The PDF of the import is missing.', 422);
    const audio = job.audioFileId ? await repository.findFile(userId, job.audioFileId) : null;

    const pages = await labelPages(pdf, {userId});
    const testPages = pagesWith(pages, TEST_LABELS);
    const answerPages = pagesWith(pages, ANSWER_LABELS);
    if (testPages.length === 0 || answerPages.length === 0) {
      const missing = testPages.length === 0 ? 'questions' : 'answers';
      return {
        status: 'failed',
        issues: [{severity: 'error', code: 'PAGES_MISSING', message: `No page with the ${missing} was found.`}],
      };
    }
    const ocr = readPageText(file.pageText);
    const readFromText =
      parseTestText !== undefined &&
      testPages.every(page => ocr.some(entry => entry.page === page && entry.text.trim()));
    const [outline, answerKey] = await Promise.all([
      readFromText
        ? parseTestText(
            ocr.filter(entry => testPages.includes(entry.page)),
            {userId},
          )
        : parseTest(pdf, {pages: testPages, userId}),
      parseAnswers(pdf, {pages: answerPages, userId}),
    ]);

    // A Listening part without transcript is written from the recording; a failure only leaves the warning.
    const listening = outline.sections.find(section => section.skill === 'listening');
    let transcriptByAi = false;
    if (parseAudio && audio && listening?.passages.some(passage => !passage.paragraphs?.length)) {
      try {
        const recording = await storage.get(audio.storageKey);
        const {parts} = recording
          ? await parseAudio(recording, {mimeType: audio.mimeType, parts: listening.passages.length, userId})
          : {parts: []};
        listening.passages.forEach((passage, index) => {
          const lines = parts.find(part => part.part === index + 1)?.lines;
          if (passage.paragraphs?.length || !lines?.length) return;
          passage.paragraphs = lines;
          transcriptByAi = true;
        });
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        console.warn('Import: the transcript could not be written from the audio:', error.message);
      }
    }

    await progress.validating();
    const certification = CERTIFICATIONS.IELTS_ACADEMIC;
    const {issues, test} = validateParsedTest({
      test: buildParsedTest(outline, answerKey, job.kind),
      kind: job.kind,
      certification,
      audio: audio && {durationSec: audio.durationSec},
    });
    if (issues.some(issue => issue.severity === 'error')) return {status: 'failed', issues};
    if (transcriptByAi) {
      issues.push({
        severity: 'warning',
        section: 'listening',
        code: 'TRANSCRIPT_BY_AI',
        message: 'The Listening transcript was written by the AI from the audio and may contain mistakes.',
      });
    }

    const testId = await repository.saveTest(userId, {
      certification: certification.id,
      test,
      durationSec: {
        listening: certification.sections.listening.durationSec,
        reading: certification.sections.reading.durationSec,
      },
      audioFileId: job.audioFileId,
    });
    return {status: 'done', testId, issues};
  };
}
