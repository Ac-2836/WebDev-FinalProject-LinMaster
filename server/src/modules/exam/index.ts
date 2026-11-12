import {Router} from 'express';

import type {ApiModule} from '../../core/module-registry';
import {storage as defaultStorage} from '../../core/storage';
import {classifyPages} from './ai';
import {prismaImportRepository} from './imports.repository';
import {addImportRoutes} from './imports.routes';
import {createImportService, type ImportServiceDeps} from './imports.service';
import './imports.openapi';

/**
 * Exam module (PLAN C4). Test imports come first (P3-04); tests (P3-07) and attempts (P3-08) follow.
 * AI tasks live in `./ai` (KH); grading and bands use the registries in `shared/src/exam`.
 */
export function createExamModule(jwtSecret: string, deps: Partial<ImportServiceDeps> = {}): ApiModule {
  const imports = createImportService({
    repository: deps.repository ?? prismaImportRepository,
    storage: deps.storage ?? defaultStorage,
    labelPages: deps.labelPages ?? classifyPages,
  });
  const router = addImportRoutes(Router(), imports, jwtSecret);
  return {name: 'exam', basePath: '/api/v1', router};
}

export type {ImportRepository} from './imports.repository';
export type {PageLabeler} from './imports.service';
