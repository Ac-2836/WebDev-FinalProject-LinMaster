import {type CreateAttemptRequest, CreateAttemptRequestSchema} from '@linmaster/shared';
import type {Router} from 'express';
import {z} from 'zod';

import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import type {AttemptService} from './attempts.service';

const createSchema = z.object({body: CreateAttemptRequestSchema});

/** Routes of the attempts of a user (PLAN C4 "API khác"). */
export function addAttemptRoutes(router: Router, service: AttemptService, jwtSecret: string): Router {
  const auth = requireAuth(jwtSecret);

  router.post(
    '/attempts',
    auth,
    validate(createSchema),
    catchAsync(async (req, res) => {
      const {testId} = req.body as CreateAttemptRequest;
      const {attempt, created} = await service.createAttempt(req.user!.userId, testId);
      res.status(created ? 201 : 200).json({attempt});
    }),
  );
  return router;
}
