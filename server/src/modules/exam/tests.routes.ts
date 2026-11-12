import {TestIdParamsSchema, type UpdateTestRequest, UpdateTestRequestSchema} from '@linmaster/shared';
import type {Router} from 'express';
import {z} from 'zod';

import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import type {TestService} from './tests.service';

type TestParams = typeof TestIdParamsSchema._output;

const testIdSchema = z.object({params: TestIdParamsSchema});
const updateTestSchema = z.object({params: TestIdParamsSchema, body: UpdateTestRequestSchema});

/** Routes of the tests of a user (PLAN C4 "API khác"). */
export function addTestRoutes(router: Router, service: TestService, jwtSecret: string): Router {
  const auth = requireAuth(jwtSecret);
  const testId = (params: unknown) => (params as TestParams).id;

  router.get(
    '/tests',
    auth,
    catchAsync(async (req, res) => {
      res.json(await service.listTests(req.user!.userId));
    }),
  );
  router.get(
    '/tests/:id',
    auth,
    validate(testIdSchema),
    catchAsync(async (req, res) => {
      res.json(await service.getTest(req.user!.userId, testId(req.params)));
    }),
  );
  router.patch(
    '/tests/:id',
    auth,
    validate(updateTestSchema),
    catchAsync(async (req, res) => {
      res.json(await service.updateTest(req.user!.userId, testId(req.params), req.body as UpdateTestRequest));
    }),
  );
  router.delete(
    '/tests/:id',
    auth,
    validate(testIdSchema),
    catchAsync(async (req, res) => {
      res.json(await service.deleteTest(req.user!.userId, testId(req.params)));
    }),
  );
  return router;
}
