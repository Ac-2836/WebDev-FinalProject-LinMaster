import cors from 'cors';
import express from 'express';
import {rateLimit} from 'express-rate-limit';
import helmet from 'helmet';
import {docsRouter} from './core/docs.route';
import type {Env} from './core/config/env';
import {errorMiddleware} from './core/error.middleware';
import {notFoundMiddleware} from './core/not-found.middleware';
import {apiModules} from './modules';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 120;

export function createApp(env: Pick<Env, 'NODE_ENV' | 'JWT_SECRET' | 'CORS_ORIGINS'>) {
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
      limit: RATE_LIMIT_PER_WINDOW,
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

  for (const apiModule of apiModules) {
    app.use(apiModule.basePath, apiModule.router);
  }

  app.use('/docs', docsRouter);
  app.use('/api/v1', notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
