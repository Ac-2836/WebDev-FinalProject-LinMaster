import {
  AttemptIdParamsSchema,
  type CreateAttemptRequest,
  CreateAttemptRequestSchema,
  type SaveAttemptStateRequest,
  SaveAttemptStateRequestSchema,
} from '@linmaster/shared';
import type {Router} from 'express';
import {z} from 'zod';

import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import type {AttemptService} from './attempts.service';

type AttemptParams = typeof AttemptIdParamsSchema._output;

const createSchema = z.object({body: CreateAttemptRequestSchema});
const attemptIdSchema = z.object({params: AttemptIdParamsSchema});
const saveStateSchema = z.object({params: AttemptIdParamsSchema, body: SaveAttemptStateRequestSchema});

/** Routes of the attempts of a user (PLAN C4 "API khác"). */
export function addAttemptRoutes(router: Router, service: AttemptService, jwtSecret: string): Router {
  const auth = requireAuth(jwtSecret);
  const attemptId = (params: unknown) => (params as AttemptParams).id;

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
  router.get(
    '/attempts/:id',
    auth,
    validate(attemptIdSchema),
    catchAsync(async (req, res) => {
      res.json(await service.getAttempt(req.user!.userId, attemptId(req.params)));
    }),
  );
  router.put(
    '/attempts/:id/state',
    auth,
    validate(saveStateSchema),
    catchAsync(async (req, res) => {
      const {state} = req.body as SaveAttemptStateRequest;
      res.json(await service.saveState(req.user!.userId, attemptId(req.params), state));
    }),
  );
  return router;
}
