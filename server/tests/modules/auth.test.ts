import express from 'express';
import request from 'supertest';
import {compare} from 'bcryptjs';
import {beforeEach, describe, expect, it} from 'vitest';

import {errorMiddleware} from '../../src/core/error.middleware';
import type {AuthRepository, AuthUser} from '../../src/modules/auth/auth.repository';
import {AuthEmailAlreadyExistsError} from '../../src/modules/auth/auth.errors';
import {createAuthModule} from '../../src/modules/auth';

const JWT_SECRET = 'auth-test-secret-with-at-least-32-characters';

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'tienhung@example.com',
    passwordHash: '',
    displayName: 'Tien Hung',
    locale: 'vi',
    targetBand: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createTestServer(repository: AuthRepository) {
  const app = express();
  app.use(express.json());
  app.use(createAuthModule(JWT_SECRET, repository).router);
  app.use(errorMiddleware);
  return app;
}

function makeRepository(): AuthRepository & {users: Map<string, AuthUser>} {
  const users = new Map<string, AuthUser>();
  return {
    users,
    async findByEmail(email) {
      return [...users.values()].find(user => user.email === email) ?? null;
    },
    async findById(id) {
      return users.get(id) ?? null;
    },
    async create(input) {
      if ([...users.values()].some(user => user.email === input.email)) {
        throw new AuthEmailAlreadyExistsError();
      }
      const user = makeUser({id: `user-${users.size + 1}`, ...input});
      users.set(user.id, user);
      return user;
    },
    async update(id, input) {
      const previous = users.get(id);
      if (!previous) throw new Error('User not found');
      const user = {...previous, ...input};
      users.set(id, user);
      return user;
    },
  };
}

describe('auth API', () => {
  let repository: ReturnType<typeof makeRepository>;
  let app: express.Express;

  beforeEach(() => {
    repository = makeRepository();
    app = createTestServer(repository);
  });

  it('registers an account with a bcrypt hash and returns a signed-in public profile', async () => {
    const response = await request(app).post('/auth/register').send({
      email: ' TienHung@Example.com ',
      password: 'safe-password-123',
      displayName: 'Tien Hung',
      targetBand: 7.5,
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email: 'tienhung@example.com',
      displayName: 'Tien Hung',
      locale: 'vi',
      targetBand: 7.5,
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    const savedUser = repository.users.get(response.body.user.id)!;
    expect(savedUser.passwordHash).not.toBe('safe-password-123');
    await expect(compare('safe-password-123', savedUser.passwordHash)).resolves.toBe(true);
  });

  it('rejects duplicate email registration', async () => {
    await request(app).post('/auth/register').send({
      email: 'tienhung@example.com',
      password: 'safe-password-123',
      displayName: 'Tien Hung',
    });

    const response = await request(app).post('/auth/register').send({
      email: 'TIENHUNG@example.com',
      password: 'safe-password-123',
      displayName: 'Tien Hung',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.status).toBe('ALREADY_EXISTS');
  });

  it('rejects passwords longer than bcrypt can safely hash', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'tienhung@example.com',
        password: 'mật-khẩu-rất-dài-'.repeat(8),
        displayName: 'Tien Hung',
      });

    expect(response.status).toBe(400);
  });

  it('logs in and returns the same generic 401 for an unknown email and a wrong password', async () => {
    await request(app).post('/auth/register').send({
      email: 'tienhung@example.com',
      password: 'safe-password-123',
      displayName: 'Tien Hung',
    });

    const wrongPassword = await request(app).post('/auth/login').send({
      email: 'tienhung@example.com',
      password: 'wrong-password-123',
    });
    const unknownEmail = await request(app).post('/auth/login').send({
      email: 'unknown@example.com',
      password: 'wrong-password-123',
    });
    const validLogin = await request(app).post('/auth/login').send({
      email: 'tienhung@example.com',
      password: 'safe-password-123',
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(validLogin.status).toBe(200);
    expect(validLogin.body.token).toEqual(expect.any(String));
  });

  it('requires a token and supports getting and updating the current profile', async () => {
    const registered = await request(app).post('/auth/register').send({
      email: 'tienhung@example.com',
      password: 'safe-password-123',
      displayName: 'Tien Hung',
    });
    const token = registered.body.token as string;

    const unauthenticated = await request(app).get('/auth/me');
    const profile = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    const updated = await request(app).patch('/auth/me').set('Authorization', `Bearer ${token}`).send({
      displayName: 'Tien Hung Updated',
      locale: 'en',
      targetBand: 8,
    });

    expect(unauthenticated.status).toBe(401);
    expect(profile.status).toBe(200);
    expect(profile.body.user.passwordHash).toBeUndefined();
    expect(updated.status).toBe(200);
    expect(updated.body.user).toMatchObject({displayName: 'Tien Hung Updated', locale: 'en', targetBand: 8});
  });

  it('rejects invalid profile patches and limits repeated login attempts', async () => {
    const registered = await request(app).post('/auth/register').send({
      email: 'tienhung@example.com',
      password: 'safe-password-123',
      displayName: 'Tien Hung',
    });
    const invalid = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${registered.body.token as string}`)
      .send({displayName: ''});
    expect(invalid.status).toBe(400);
    const forbiddenFields = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${registered.body.token as string}`)
      .send({email: 'new@example.com'});
    expect(forbiddenFields.status).toBe(400);
    const invalidBand = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${registered.body.token as string}`)
      .send({targetBand: 7.3});
    expect(invalidBand.status).toBe(400);

    const limitedApp = createTestServer(makeRepository());
    let lastResponse;
    for (let attempt = 0; attempt < 11; attempt++) {
      lastResponse = await request(limitedApp).post('/auth/login').send({
        email: 'unknown@example.com',
        password: 'wrong-password-123',
      });
    }
    expect(lastResponse?.status).toBe(429);
  });

  it('limits account registration to five attempts per hour', async () => {
    const limitedApp = createTestServer(makeRepository());
    let lastResponse;
    for (let attempt = 0; attempt < 6; attempt++) {
      lastResponse = await request(limitedApp)
        .post('/auth/register')
        .send({
          email: `tienhung-${attempt}@example.com`,
          password: 'safe-password-123',
          displayName: 'Tien Hung',
        });
    }

    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.body.error.status).toBe('RESOURCE_EXHAUSTED');
  });
});
