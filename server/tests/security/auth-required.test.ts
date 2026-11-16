import request from 'supertest';
import {describe, expect, it} from 'vitest';

import {createApp} from '../../src/app';
import {signJwt} from '../../src/core/jwt';
import {generateOpenApiDocument} from '../../src/core/openapi-registry';

const APP_CONFIG = {
  NODE_ENV: 'test' as const,
  JWT_SECRET: 'security-test-secret-that-is-at-least-32-chars',
  CORS_ORIGINS: ['http://localhost:3000'],
};
const ID = '0192f7e0-0bcd-7000-8000-000000000001';
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

// Every documented operation that declares `security` must refuse a request without a token, before it reads the
// body or the id (P5-02). The list comes from Swagger, and route-coverage keeps Swagger equal to the real routes.
function securedOperations() {
  const operations: Array<{method: (typeof METHODS)[number]; path: string}> = [];
  for (const [path, item] of Object.entries(generateOpenApiDocument().paths ?? {})) {
    for (const method of METHODS) {
      const operation = item?.[method];
      if (operation?.security?.length) operations.push({method, path: path.replace(/\{[^}]+\}/g, ID)});
    }
  }
  return operations;
}

describe('authentication on every route', () => {
  const operations = securedOperations();

  it('finds the secured operations of every module', () => {
    const modules = new Set(operations.map(({path}) => path.split('/')[3]));
    expect([...modules].sort()).toEqual(['attempts', 'auth', 'flashcards', 'library', 'stats', 'tests', 'vocab']);
  });

  it.each(operations)('$method $path refuses a request without a token', async ({method, path}) => {
    const response = await request(createApp(APP_CONFIG))[method](path).send({});
    expect(response.status).toBe(401);
    expect(response.body.error.status).toBe('UNAUTHENTICATED');
  });

  it.each(operations.slice(0, 3))(
    '$method $path refuses a token signed with another secret',
    async ({method, path}) => {
      const token = signJwt(ID, 'another-secret-that-is-at-least-32-characters');
      const response = await request(createApp(APP_CONFIG))[method](path).set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(401);
    },
  );
});
