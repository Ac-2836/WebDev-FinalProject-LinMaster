import express from 'express';
import {healthRouter} from './core/health.route';
import {errorMiddleware} from './core/error.middleware';
import {notFoundMiddleware} from './core/not-found.middleware';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api/v1', healthRouter);
  app.use('/api/v1', notFoundMiddleware);

  // Middleware xử lý lỗi phải nằm sau các route.
  app.use(errorMiddleware);

  return app;
}
