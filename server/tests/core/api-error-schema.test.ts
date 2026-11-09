import request from 'supertest';
import {describe, expect, it} from 'vitest';

import {ApiErrorBody, ApiErrorStatus} from '../../../shared/src/core/api-error';
import {createApp} from '../../src/app';

// Keeps the shared error schema the client parses in step with what the server really sends.
describe('shared ApiErrorBody', () => {
  it('matches the error middleware output', async () => {
    const res = await request(createApp()).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    const body = ApiErrorBody.parse(res.body);
    expect(ApiErrorStatus.safeParse(body.error.status).success).toBe(true);
  });

  it('still parses a status the client does not know yet', () => {
    expect(ApiErrorBody.safeParse({error: {code: 409, status: 'TEST_HAS_ATTEMPTS', message: 'x'}}).success).toBe(true);
    expect(ApiErrorStatus.safeParse('TEST_HAS_ATTEMPTS').success).toBe(false);
  });
});
