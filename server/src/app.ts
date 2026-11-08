import express from 'express';
import {errorMiddleware} from './middlewares/error.middleware';
import {healthRouter} from './core/health.route';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api/v1', healthRouter);

  // Middleware xử lý lỗi phải nằm sau các route.
  app.use(errorMiddleware);

  return app;
}
