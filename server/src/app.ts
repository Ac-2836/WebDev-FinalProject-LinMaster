import express from 'express';
import {docsRouter} from './core/docs.route';
import {errorMiddleware} from './core/error.middleware';
import {notFoundMiddleware} from './core/not-found.middleware';
import {apiModules} from './modules';

export function createApp() {
  const app = express();

  app.use(express.json());

  // Mount module routes before the not-found middleware.
  for (const apiModule of apiModules) {
    app.use(apiModule.basePath, apiModule.router);
  }

  app.use('/docs', docsRouter);
  app.use('/api/v1', notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
