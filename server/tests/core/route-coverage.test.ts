import {Router} from 'express';
import request from 'supertest';
import {describe, expect, it} from 'vitest';

import {generateOpenApiDocument} from '../../src/core/openapi-registry';
import {findUndocumentedRoutes} from '../../src/core/route-coverage';
import type {ApiModule} from '../../src/core/module-registry';
import {createApiModules} from '../../src/modules';
import {createApp} from '../../src/app';

const APP_CONFIG = {
  NODE_ENV: 'test' as const,
  JWT_SECRET: 'test-secret-that-is-at-least-thirty-two-characters',
  CORS_ORIGINS: ['http://localhost:3000'],
};

describe('OpenAPI route coverage', () => {
  it('documents every registered API route', () => {
    const document = generateOpenApiDocument();

    expect(findUndocumentedRoutes(createApiModules(APP_CONFIG.JWT_SECRET), document)).toEqual([]);
  });

  it('reports a route that has no OpenAPI operation', () => {
    const router = Router();
    router.post('/missing-doc', (_req, res) => res.sendStatus(204));

    const undocumentedModule: ApiModule = {
      name: 'test-undocumented',
      basePath: '/api/v1',
      router,
    };

    expect(findUndocumentedRoutes([undocumentedModule], generateOpenApiDocument())).toEqual([
      {method: 'post', path: '/api/v1/missing-doc'},
    ]);
  });

  it('rejects nested routers so their routes cannot bypass coverage checks', () => {
    const router = Router();
    const nestedRouter = Router();
    nestedRouter.get('/missing-doc', (_req, res) => res.sendStatus(204));
    router.use('/nested', nestedRouter);

    const moduleWithNestedRouter: ApiModule = {
      name: 'test-nested-router',
      basePath: '/api/v1',
      router,
    };

    expect(() => findUndocumentedRoutes([moduleWithNestedRouter], generateOpenApiDocument())).toThrow(
      'Nested routers are not supported',
    );
  });

  it('generates a valid OpenAPI document for the health endpoint', () => {
    const document = generateOpenApiDocument();

    expect(document.openapi).toBe('3.1.0');
    expect(document.paths?.['/api/v1/health']?.get).toBeDefined();
    expect(document.paths?.['/api/v1/auth/register']?.post).toBeDefined();
    expect(document.paths?.['/api/v1/auth/login']?.post).toBeDefined();
    expect(document.paths?.['/api/v1/auth/me']?.get).toMatchObject({security: [{bearerAuth: []}]});
    expect(document.paths?.['/api/v1/auth/me']?.patch).toMatchObject({security: [{bearerAuth: []}]});
    expect(document.paths?.['/api/v1/auth/register']?.post).toMatchObject({
      requestBody: {content: {'application/json': {examples: {register: {value: {email: 'tienhung@example.com'}}}}}},
    });
    expect(document.paths?.['/api/v1/auth/login']?.post).toMatchObject({
      requestBody: {content: {'application/json': {examples: {login: {value: {email: 'tienhung@example.com'}}}}}},
    });
    expect(document.paths?.['/api/v1/auth/register']?.post).toMatchObject({
      responses: {
        201: {content: {'application/json': {examples: {success: {value: {user: {email: 'tienhung@example.com'}}}}}}},
      },
    });
  });

  it('serves Swagger UI and the generated OpenAPI document', async () => {
    const app = createApp(APP_CONFIG);

    const docsResponse = await request(app).get('/docs');
    expect(docsResponse.status).toBe(301);
    expect(docsResponse.headers.location).toBe('/docs/');

    const uiResponse = await request(app).get('/docs/');
    expect(uiResponse.status).toBe(200);
    expect(uiResponse.text).toContain('swagger-ui');

    const openApiResponse = await request(app).get('/docs/openapi.json');
    expect(openApiResponse.status).toBe(200);
    expect(openApiResponse.body.paths['/api/v1/health']?.get).toBeDefined();
  });
});
