import {compare, hash} from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import {beforeEach, describe, expect, it} from 'vitest';

import {errorMiddleware} from '../../src/core/error.middleware';
import {signJwt} from '../../src/core/jwt';
import {generateOpenApiDocument} from '../../src/core/openapi-registry';
import {createAuthModule} from '../../src/modules/auth';
import {AuthEmailAlreadyExistsError} from '../../src/modules/auth/auth.errors';
import type {AuthRepository, AuthUser} from '../../src/modules/auth/auth.repository';

const JWT_SECRET = 'auth-account-test-secret-with-32-characters';
const PASSWORD = 'safe-password-123';

/** In-memory users with the same unique email rule as the database. */
function makeRepository(users: AuthUser[]): AuthRepository & {users: Map<string, AuthUser>} {
  const byId = new Map(users.map(user => [user.id, user]));
  return {
    users: byId,
    async findByEmail(email) {
      return [...byId.values()].find(user => user.email === email) ?? null;
    },
    async findById(id) {
      return byId.get(id) ?? null;
    },
    async create() {
      throw new Error('not used');
    },
    async update(id, input) {
      const previous = byId.get(id);
      if (!previous) return null;
      if (input.email && [...byId.values()].some(user => user.id !== id && user.email === input.email)) {
        throw new AuthEmailAlreadyExistsError();
      }
      const user = {...previous, ...input};
      byId.set(id, user);
      return user;
    },
  };
}

// bcrypt at 12 rounds (the service) is slow on a busy machine.
describe('account email and password', {timeout: 20_000}, () => {
  let repository: ReturnType<typeof makeRepository>;
  let app: express.Express;

  beforeEach(async () => {
    const passwordHash = await hash(PASSWORD, 4);
    const user = (id: string, email: string): AuthUser => ({
      id,
      email,
      passwordHash,
      displayName: id,
      locale: 'vi',
      targetBand: null,
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    repository = makeRepository([user('u1', 'owner@example.com'), user('u2', 'taken@example.com')]);
    app = express();
    app.use(express.json());
    app.use(createAuthModule(JWT_SECRET, repository).router);
    app.use(errorMiddleware);
  });

  const patch = (path: string, body: object, userId = 'u1') =>
    request(app)
      .patch(`/auth/me/${path}`)
      .set('Authorization', `Bearer ${signJwt(userId, JWT_SECRET)}`)
      .send(body);

  it('changes the email, lower-cased, after checking the current password', async () => {
    const response = await patch('email', {email: ' New@Example.com ', currentPassword: PASSWORD}).expect(200);
    expect(response.body.user).toMatchObject({id: 'u1', email: 'new@example.com'});
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(repository.users.get('u1')!.email).toBe('new@example.com');
  });

  it('refuses a wrong password (403) and an email of another account (409)', async () => {
    const wrong = await patch('email', {email: 'new@example.com', currentPassword: 'wrong-password'}).expect(403);
    expect(wrong.body.error.status).toBe('WRONG_PASSWORD');
    const taken = await patch('email', {email: 'TAKEN@example.com', currentPassword: PASSWORD}).expect(409);
    expect(taken.body.error.status).toBe('ALREADY_EXISTS');
    expect(repository.users.get('u1')!.email).toBe('owner@example.com');
  });

  it('changes the password with bcrypt, so only the new one works', async () => {
    await patch('password', {currentPassword: PASSWORD, newPassword: 'another-safe-password'}).expect(204);
    const saved = repository.users.get('u1')!.passwordHash;
    await expect(compare('another-safe-password', saved)).resolves.toBe(true);
    await expect(compare(PASSWORD, saved)).resolves.toBe(false);
    await patch('password', {currentPassword: PASSWORD, newPassword: 'third-safe-password'}).expect(403);
  });

  it('checks the new password like registration and refuses unknown fields', async () => {
    await patch('password', {currentPassword: PASSWORD, newPassword: 'short'}).expect(400);
    await patch('password', {currentPassword: PASSWORD, newPassword: 'é'.repeat(37)}).expect(400); // 74 bytes
    await patch('email', {email: 'not-an-email', currentPassword: PASSWORD}).expect(400);
    await patch('email', {email: 'new@example.com', currentPassword: PASSWORD, role: 'admin'}).expect(400);
  });

  it('needs a signed-in user', async () => {
    await request(app).patch('/auth/me/email').send({email: 'a@example.com', currentPassword: PASSWORD}).expect(401);
    await request(app)
      .patch('/auth/me/password')
      .send({currentPassword: PASSWORD, newPassword: 'x'.repeat(8)})
      .expect(401);
  });

  it('limits wrong guesses like login (10 per 15 minutes)', async () => {
    for (let i = 0; i < 10; i++) await patch('email', {email: 'n@example.com', currentPassword: `wrong-${i}`});
    await patch('email', {email: 'n@example.com', currentPassword: PASSWORD}).expect(429);
  });

  it('is documented in Swagger with bearer auth', () => {
    const paths = generateOpenApiDocument().paths ?? {};
    for (const path of ['email', 'password']) {
      expect(paths[`/api/v1/auth/me/${path}`]?.patch).toMatchObject({security: [{bearerAuth: []}]});
    }
  });
});
