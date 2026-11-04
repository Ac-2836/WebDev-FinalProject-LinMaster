import express from 'express';

import {healthRouter} from './core/health.route';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', healthRouter);
  return app;
}
