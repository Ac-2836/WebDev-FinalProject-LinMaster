import {compare, hash, hashSync} from 'bcryptjs';
import type {AuthPublicUser, LoginRequest, RegisterRequest, UpdateProfileRequest} from '@linmaster/shared';
import {AppError} from '../../core/app-error';
import {signJwt} from '../../core/jwt';
import {AuthEmailAlreadyExistsError} from './auth.errors';
import type {AuthRepository, AuthUser} from './auth.repository';

const HASH_ROUNDS = 12;
const INVALID_CREDENTIALS = 'Email or password is incorrect.';
export const DUMMY_PASSWORD_HASH = hashSync('linmaster-dummy-password', HASH_ROUNDS);

export interface AuthCrypto {
  hash(password: string, rounds: number): Promise<string>;
  compare(password: string, passwordHash: string): Promise<boolean>;
}

const bcryptCrypto: AuthCrypto = {hash, compare};

function toPublicUser(user: AuthUser): AuthPublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    targetBand: user.targetBand,
    createdAt: user.createdAt.toISOString(),
  };
}

export function createAuthService(repository: AuthRepository, jwtSecret: string, crypto: AuthCrypto = bcryptCrypto) {
  return {
    async register(input: RegisterRequest) {
      const passwordHash = await crypto.hash(input.password, HASH_ROUNDS);
      try {
        const user = await repository.create({
          email: input.email,
          passwordHash,
          displayName: input.displayName,
          locale: input.locale ?? 'vi',
          targetBand: input.targetBand ?? null,
        });
        return {token: signJwt(user.id, jwtSecret), user: toPublicUser(user)};
      } catch (error) {
        if (error instanceof AuthEmailAlreadyExistsError) {
          throw new AppError('Email already registered.', 409, undefined, 'ALREADY_EXISTS');
        }
        throw error;
      }
    },

    async login(input: LoginRequest) {
      const user = await repository.findByEmail(input.email);
      const validPassword = await crypto.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
      if (!user || !validPassword) throw new AppError(INVALID_CREDENTIALS, 401);
      return {token: signJwt(user.id, jwtSecret), user: toPublicUser(user)};
    },

    async getProfile(userId: string): Promise<AuthPublicUser> {
      const user = await repository.findById(userId);
      if (!user) throw new AppError('User not found.', 404);
      return toPublicUser(user);
    },

    async updateProfile(userId: string, input: UpdateProfileRequest): Promise<AuthPublicUser> {
      const user = await repository.update(userId, input);
      if (!user) throw new AppError('User not found.', 404);
      return toPublicUser(user);
    },
  };
}
