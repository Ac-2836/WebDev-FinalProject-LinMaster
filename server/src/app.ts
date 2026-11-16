import cors from 'cors';
import express from 'express';
import {rateLimit} from 'express-rate-limit';
import helmet from 'helmet';
import {docsRouter} from './core/docs.route';
import type {Env} from './core/config/env';
import {errorMiddleware} from './core/error.middleware';
import {notFoundMiddleware} from './core/not-found.middleware';
import {createApiModules} from './modules';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 120;

export interface AppOptions {
  /**
   * Requests per minute per IP on `/api/v1`. Only the Playwright API changes it: one browser there opens many
   * pages in a few seconds, from one IP, for the whole suite.
   */
  requestsPerMinute?: number;
  /** Accounts per hour per IP (5 by default). The Playwright suite registers a new learner in most tests. */
  registrationsPerHour?: number;
}

export function createApp(
  env: Pick<Env, 'NODE_ENV' | 'JWT_SECRET' | 'CORS_ORIGINS'>,
  {requestsPerMinute = RATE_LIMIT_PER_WINDOW, registrationsPerHour}: AppOptions = {},
) {
  const app = express();

  // Render puts one proxy in front of the app; without this every user shares the proxy IP.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || env.CORS_ORIGINS.includes(origin));
      },
      credentials: true,
    }),
  );
  app.use(
    '/api/v1',
    rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: requestsPerMinute,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: req => req.path === '/health',
      handler: (_req, res) => {
        res.status(429).json({
          error: {
            code: 429,
            status: 'RESOURCE_EXHAUSTED',
            message: 'Too many requests. Please try again later.',
          },
        });
      },
    }),
  );
  app.use(express.json({limit: '1mb'}));

  for (const apiModule of createApiModules(env.JWT_SECRET, {registrationsPerHour})) {
    app.use(apiModule.basePath, apiModule.router);
  }

  app.use('/docs', docsRouter);
  app.use('/api/v1', notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
