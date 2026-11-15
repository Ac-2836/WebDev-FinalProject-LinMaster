import {type StatsActivityQuery, StatsActivityQuerySchema} from '@linmaster/shared';
import {Router} from 'express';
import {z} from 'zod';

import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import type {StatsService} from './stats.service';

const activityRequest = z.object({query: StatsActivityQuerySchema.strict()});

/** `/stats/*`: always the signed-in user's own numbers; there is no user id to ask for someone else's. */
export function createStatsRouter(service: StatsService, jwtSecret: string): Router {
  const router = Router();
  const auth = requireAuth(jwtSecret);
  router.get(
    '/stats/overview',
    auth,
    catchAsync(async (req, res) => res.json(await service.overview(req.user!.userId))),
  );
  router.get(
    '/stats/activity',
    auth,
    validate(activityRequest),
    catchAsync(async (req, res) => res.json(await service.activity(req.user!.userId, req.query as StatsActivityQuery))),
  );
  router.get(
    '/stats/bands',
    auth,
    catchAsync(async (req, res) => res.json(await service.bands(req.user!.userId))),
  );
  router.get(
    '/stats/vocab',
    auth,
    catchAsync(async (req, res) => res.json(await service.vocab(req.user!.userId))),
  );
  router.get(
    '/stats/community',
    auth,
    catchAsync(async (req, res) => res.json(await service.community(req.user!.userId))),
  );
  router.get(
    '/stats/weaknesses',
    auth,
    catchAsync(async (req, res) => res.json(await service.weaknesses(req.user!.userId))),
  );
  return router;
}
