import {Router} from 'express';

import type {ApiModule} from '../../core/module-registry';
import {storage as defaultStorage} from '../../core/storage';
import {classifyPages} from './ai';
import {createImportJobs, type ImportJobs, type ImportProcessor, pendingImportProcessor} from './import-jobs';
import {prismaImportRepository} from './imports.repository';
import {addImportRoutes} from './imports.routes';
import {createImportService, type ImportServiceDeps} from './imports.service';
import './imports.openapi';

export interface ExamModuleDeps extends Partial<Omit<ImportServiceDeps, 'jobs'>> {
  /** Reads an import into a test; P3-06 replaces the default. */
  processImport?: ImportProcessor;
  /** Built from the other dependencies when left out. */
  jobs?: ImportJobs;
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
  const router = addImportRoutes(Router(), imports, jwtSecret);
  return {name: 'exam', basePath: '/api/v1', router};
}

export {createImportJobs, type ImportJobs, type ImportProcessor} from './import-jobs';
export type {ImportJob, ImportOutcome, ImportRepository} from './imports.repository';
export type {PageLabeler} from './imports.service';
