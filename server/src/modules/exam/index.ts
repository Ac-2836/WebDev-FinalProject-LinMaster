import {Router} from 'express';

import type {ApiModule} from '../../core/module-registry';

/**
 * Exam module (PLAN C4). Routes come in later issues: test imports (P3-04), tests (P3-07) and attempts (P3-08).
 * AI tasks live in `./ai` (KH); grading and bands use the registries in `shared/src/exam`.
 */
export function createExamModule(): ApiModule {
  return {name: 'exam', basePath: '/api/v1', router: Router()};
}
