import {CERTIFICATIONS, type PageLabel, type PageLabels} from '@linmaster/shared';

import {AppError} from '../../core/app-error';
import type {Storage} from '../../core/storage';
import {buildParsedTest, type parseAnswers, type parseTest} from './ai';
import type {ImportProcessor} from './import-jobs';
import {validateParsedTest} from './import-validator';
import type {ImportRepository} from './imports.repository';
import type {PageLabeler} from './imports.service';

export interface ImportProcessorDeps {
  repository: ImportRepository;
  storage: Storage;
  /** KH's AI tasks (`./ai`), injected so tests never call the real model. */
  labelPages: PageLabeler;
  parseTest: typeof parseTest;
  parseAnswers: typeof parseAnswers;
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
  parseAnswers,
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
    const [outline, answerKey] = await Promise.all([
      parseTest(pdf, {pages: testPages, userId}),
      parseAnswers(pdf, {pages: answerPages, userId}),
    ]);

    await progress.validating();
    const certification = CERTIFICATIONS.IELTS_ACADEMIC;
    const {issues, test} = validateParsedTest({
      test: buildParsedTest(outline, answerKey, job.kind),
      kind: job.kind,
      certification,
      audio: audio && {durationSec: audio.durationSec},
    });
    if (issues.some(issue => issue.severity === 'error')) return {status: 'failed', issues};

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
