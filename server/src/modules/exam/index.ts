import {Router} from 'express';

import type {ApiModule} from '../../core/module-registry';
import {storage as defaultStorage} from '../../core/storage';
import {classifyPages, explainAnswer, parseAnswers, parseAudio, parseTest, parseTestFromText} from './ai';
import {type AttemptRepository, prismaAttemptRepository} from './attempts.repository';
import {addAttemptRoutes} from './attempts.routes';
import {createAttemptService} from './attempts.service';
import './attempts.openapi';
import {createImportJobs, type ImportJobs, type ImportProcessor} from './import-jobs';
import {createImportProcessor} from './import-processor';
import {prismaImportRepository} from './imports.repository';
import {addImportRoutes} from './imports.routes';
import {createImportService, type ImportServiceDeps} from './imports.service';
import './imports.openapi';
import {prismaTestRepository, type TestRepository} from './tests.repository';
import {addTestRoutes} from './tests.routes';
import {createTestService} from './tests.service';
import './tests.openapi';

export interface ExamModuleDeps extends Partial<Omit<ImportServiceDeps, 'jobs'>> {
  /** Reads an import into a test; built from the other dependencies when left out. */
  processImport?: ImportProcessor;
  /** AI tasks of `./ai`; tests pass fakes. */
  parseTest?: typeof parseTest;
  parseTestText?: typeof parseTestFromText;
  parseAnswers?: typeof parseAnswers;
  parseAudio?: typeof parseAudio;
  /** Built from the other dependencies when left out. */
  jobs?: ImportJobs;
  testRepository?: TestRepository;
  attemptRepository?: AttemptRepository;
  /** AI task `explain-answer.v1`; tests pass a fake. */
  explainAnswer?: typeof explainAnswer;
  /** Server clock of attempts; tests pass a fixed one. */
  now?: () => Date;
}

/**
 * Exam module (PLAN C4). Test imports come first (P3-04); tests (P3-07) and attempts (P3-08) follow.
 * AI tasks live in `./ai` (KH); grading and bands use the registries in `shared/src/exam`.
 */
export function createExamModule(jwtSecret: string, deps: ExamModuleDeps = {}): ApiModule {
  const repository = deps.repository ?? prismaImportRepository;
  const storage = deps.storage ?? defaultStorage;
  const labelPages = deps.labelPages ?? classifyPages;
  const process =
    deps.processImport ??
    createImportProcessor({
      repository,
      storage,
      labelPages,
      parseTest: deps.parseTest ?? parseTest,
      parseTestText: deps.parseTestText ?? parseTestFromText,
      parseAnswers: deps.parseAnswers ?? parseAnswers,
      parseAudio: deps.parseAudio ?? parseAudio,
    });
  const jobs = deps.jobs ?? createImportJobs({repository, storage, process});
  const imports = createImportService({repository, storage, labelPages, jobs});
  const testRepository = deps.testRepository ?? prismaTestRepository;
  const tests = createTestService(testRepository);
  const attempts = createAttemptService({
    attempts: deps.attemptRepository ?? prismaAttemptRepository,
    tests: testRepository,
    storage,
    explain: deps.explainAnswer ?? explainAnswer,
    now: deps.now,
  });
  const router = addAttemptRoutes(
    addTestRoutes(addImportRoutes(Router(), imports, jwtSecret), tests, jwtSecret),
    attempts,
    jwtSecret,
  );
  return {name: 'exam', basePath: '/api/v1', router};
}

export {createImportJobs, type ImportJobs, type ImportProcessor} from './import-jobs';
export type {ImportJob, ImportOutcome, ImportRepository} from './imports.repository';
export type {AttemptRepository, AttemptRow, NewAttempt} from './attempts.repository';
export type {PageLabeler} from './imports.service';
export type {TestContentRow, TestRepository, TestRow} from './tests.repository';
export {getPassageText, type PassageText} from './passage-text';
export {getExamStats, getTestCommunityStats, type ExamStats} from './exam.stats';
export {
  findTestOwner,
  getLibraryTest,
  hideLibraryTest,
  listLibraryTests,
  setLibraryTestVisibility,
} from './exam.library';
