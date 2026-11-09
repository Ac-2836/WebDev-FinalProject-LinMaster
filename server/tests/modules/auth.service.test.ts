import {getRounds} from 'bcryptjs';
import {describe, expect, it, vi} from 'vitest';

import type {AuthCrypto} from '../../src/modules/auth/auth.service';
import {createAuthService, DUMMY_PASSWORD_HASH} from '../../src/modules/auth/auth.service';
import type {AuthRepository, AuthUser} from '../../src/modules/auth/auth.repository';

const JWT_SECRET = 'auth-service-test-secret-with-32-characters';

function makeRepository(user: AuthUser | null): AuthRepository {
  return {
    async findByEmail() {
      return user;
    },
    async findById() {
      return user;
    },
    async create() {
      if (!user) throw new Error('Test repository does not create users.');
      return user;
    },
    async update() {
      return user;
    },
  };
}

describe('auth service', () => {
  it('uses one cost-12 bcrypt comparison for an unknown email', async () => {
    const comparePassword = vi.fn<AuthCrypto['compare']>().mockResolvedValue(false);
    const service = createAuthService(makeRepository(null), JWT_SECRET, {
      compare: comparePassword,
      hash: vi.fn<AuthCrypto['hash']>(),
    });

    await expect(service.login({email: 'unknown@example.com', password: 'wrong-password-123'})).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(comparePassword).toHaveBeenCalledTimes(1);
    expect(comparePassword.mock.calls[0][1]).toBe(DUMMY_PASSWORD_HASH);
    expect(getRounds(comparePassword.mock.calls[0][1])).toBe(12);
  });

  it('returns 404 if the current user has been deleted before a profile update', async () => {
    const repository = makeRepository(null);
    const service = createAuthService(repository, JWT_SECRET);

    await expect(service.updateProfile('deleted-user', {displayName: 'New name'})).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
