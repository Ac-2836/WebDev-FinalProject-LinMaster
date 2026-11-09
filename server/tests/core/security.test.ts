import express from 'express';
import request from 'supertest';
import {describe, expect, it} from 'vitest';

import {createApp} from '../../src/app';
import {errorMiddleware} from '../../src/core/error.middleware';
import {requireAuth} from '../../src/core/require-auth.middleware';
import {signJwt} from '../../src/core/jwt';

const JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';
const APP_CONFIG = {
  NODE_ENV: 'test' as const,
  JWT_SECRET,
  CORS_ORIGINS: ['http://localhost:3000'],
};

function createProtectedApp() {
  const app = express();

  app.get('/protected', requireAuth(JWT_SECRET), (req, res) => {
    res.json({userId: req.user?.userId});
  });
  app.use(errorMiddleware);

  return app;
}

describe('server security middleware', () => {
  it('returns 401 when a protected route receives no token', async () => {
    const response = await request(createProtectedApp()).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 401,
        status: 'UNAUTHENTICATED',
        message: 'Authentication required.',
      },
    });
  });

  it('accepts a valid signed token and exposes its user id on the request', async () => {
    const token = signJwt('user-123', JWT_SECRET);
    const response = await request(createProtectedApp()).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({userId: 'user-123'});
  });

  it('rejects an invalid token with 401', async () => {
    const response = await request(createProtectedApp())
      .get('/protected')
      .set('Authorization', 'Bearer invalid.token.value');

    expect(response.status).toBe(401);
    expect(response.body.error.status).toBe('UNAUTHENTICATED');
  });

  it('sets security headers and allows only configured CORS origins', async () => {
    const app = createApp(APP_CONFIG);
    const allowed = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:3000');
    const disallowed = await request(app).get('/api/v1/health').set('Origin', 'https://untrusted.example');

    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(disallowed.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects a JSON request body larger than the configured limit', async () => {
    const response = await request(createApp(APP_CONFIG))
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({payload: 'x'.repeat(1_100_000)}));

    expect(response.status).toBe(413);
    expect(response.body.error.status).toBe('INVALID_ARGUMENT');
  });

  it('limits repeated requests to the API', async () => {
    const app = createApp(APP_CONFIG);
    let response;

    for (let requestNumber = 0; requestNumber < 121; requestNumber += 1) {
      response = await request(app).get('/api/v1/does-not-exist');
    }

    expect(response?.status).toBe(429);
    expect(response?.body.error.status).toBe('RESOURCE_EXHAUSTED');
  });

  it('does not rate limit health checks', async () => {
    const app = createApp(APP_CONFIG);
    let response;

    for (let requestNumber = 0; requestNumber < 121; requestNumber += 1) {
      response = await request(app).get('/api/v1/health');
    }

    expect(response?.status).toBe(200);
    expect(response?.body).toEqual({status: 'ok'});
  });

  it('keeps rate limits separate for forwarded client IPs in production', async () => {
    const app = createApp({...APP_CONFIG, NODE_ENV: 'production'});
    let responseFromUserA;

    for (let requestNumber = 0; requestNumber < 121; requestNumber += 1) {
      responseFromUserA = await request(app).get('/api/v1/health/').set('X-Forwarded-For', '1.1.1.1');
    }

    const responseFromUserB = await request(app).get('/api/v1/health/').set('X-Forwarded-For', '2.2.2.2');

    expect(responseFromUserA?.status).toBe(429);
    expect(responseFromUserB.status).toBe(200);
  });
});
