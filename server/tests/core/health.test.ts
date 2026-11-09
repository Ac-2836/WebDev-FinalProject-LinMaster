import request from 'supertest';
import {describe, expect, it} from 'vitest';

import {createApp} from '../../src/app';

const APP_CONFIG = {
  NODE_ENV: 'test' as const,
  JWT_SECRET: 'test-secret-that-is-at-least-thirty-two-characters',
  CORS_ORIGINS: ['http://localhost:3000'],
};

describe('GET /api/v1/health', () => {
  it('returns ok', async () => {
    const res = await request(createApp(APP_CONFIG)).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({status: 'ok'});
  });
});
