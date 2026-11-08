import {Router} from 'express';
import {z} from 'zod';
import {openApiRegistry} from './openapi-registry';
import type {ApiModule} from './module-registry';

const healthRouter = Router();
const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/health',
  summary: 'Check API health',
  description: 'Returns the health status of the API server.',
  tags: ['Core'],
  responses: {
    200: {
      description: 'The API server is healthy.',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

// Used by Render health checks and UptimeRobot (PLAN part E).
healthRouter.get('/health', (_req, res) => {
  res.json({status: 'ok'});
});

export const healthModule: ApiModule = {
  name: 'core',
  basePath: '/api/v1',
  router: healthRouter,
};
