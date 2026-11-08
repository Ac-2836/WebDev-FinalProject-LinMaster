import {Router} from 'express';
import swaggerUi from 'swagger-ui-express';
import {generateOpenApiDocument} from './openapi-registry';

export const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(generateOpenApiDocument());
});

docsRouter.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    swaggerUrl: '/docs/openapi.json',
  }),
);
