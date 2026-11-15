import request from 'supertest';
import {describe, expect, it} from 'vitest';

import {createApp} from '../../src/app';
import {signJwt} from '../../src/core/jwt';
import {UPLOADS_PER_HOUR} from '../../src/core/user-rate-limit';

const JWT_SECRET = 'upload-limit-secret-that-is-at-least-32-chars';
const USER = '0192f7e0-0bcd-7000-8000-0000000000a1';
const OTHER = '0192f7e0-0bcd-7000-8000-0000000000a2';

// Requests stop before storage (no file, empty body), but every one counts towards the limit of the user.
describe.each(['/api/v1/tests/imports/files', '/api/v1/vocab/documents'])('upload limit on %s', path => {
  it('refuses a user after the hourly limit, but not another user', async () => {
    const app = createApp({NODE_ENV: 'test', JWT_SECRET, CORS_ORIGINS: []});
    const post = (userId: string) =>
      request(app)
        .post(path)
        .set('Authorization', `Bearer ${signJwt(userId, JWT_SECRET)}`)
        .send({});

    for (let upload = 0; upload < UPLOADS_PER_HOUR; upload += 1) expect((await post(USER)).status).toBe(400);
    const refused = await post(USER);
    expect(refused.status).toBe(429);
    expect(refused.body.error.status).toBe('RESOURCE_EXHAUSTED');
    expect((await post(OTHER)).status).toBe(400);
  });
});
