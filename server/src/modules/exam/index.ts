import {Router} from 'express';

import type {ApiModule} from '../../core/module-registry';
import {storage as defaultStorage} from '../../core/storage';
import {classifyPages} from './ai';
import {type AttemptRepository, prismaAttemptRepository} from './attempts.repository';
import {addAttemptRoutes} from './attempts.routes';
import {createAttemptService} from './attempts.service';
import './attempts.openapi';
import {createImportJobs, type ImportJobs, type ImportProcessor, pendingImportProcessor} from './import-jobs';
import {prismaImportRepository} from './imports.repository';
import {addImportRoutes} from './imports.routes';
import {createImportService, type ImportServiceDeps} from './imports.service';
import './imports.openapi';
import {prismaTestRepository, type TestRepository} from './tests.repository';
import {addTestRoutes} from './tests.routes';
import {createTestService} from './tests.service';
import './tests.openapi';

export interface ExamModuleDeps extends Partial<Omit<ImportServiceDeps, 'jobs'>> {
  /** Reads an import into a test; P3-06 replaces the default. */
  processImport?: ImportProcessor;
  /** Built from the other dependencies when left out. */
  jobs?: ImportJobs;
  testRepository?: TestRepository;
  attemptRepository?: AttemptRepository;
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
  const jobs =
    deps.jobs ?? createImportJobs({repository, storage, process: deps.processImport ?? pendingImportProcessor});
  const imports = createImportService({repository, storage, labelPages: deps.labelPages ?? classifyPages, jobs});
  const testRepository = deps.testRepository ?? prismaTestRepository;
  const tests = createTestService(testRepository);
  const attempts = createAttemptService({
    attempts: deps.attemptRepository ?? prismaAttemptRepository,
    tests: testRepository,
    storage,
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
