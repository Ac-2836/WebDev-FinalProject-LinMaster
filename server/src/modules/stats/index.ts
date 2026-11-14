import {Router} from 'express';

import type {ApiModule} from '../../core/module-registry';
import {requireAuth} from '../../core/require-auth.middleware';

/**
 * Stats module (PLAN C6): the personal dashboard. It owns no table; every number comes from the public API of
 * vocab, flashcard and exam. Routes are added by P4-04: overview, activity, bands, vocab, weaknesses (community later).
 */
export function createStatsModule(jwtSecret: string): ApiModule {
  const router = Router();
  // Only the account owner sees its stats: every /stats route needs a signed-in user.
  router.use('/stats', requireAuth(jwtSecret));
  return {name: 'stats', basePath: '/api/v1', router};
}
