import {compare, hash, hashSync} from 'bcryptjs';
import type {
  AuthPublicUser,
  ChangeEmailRequest,
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from '@linmaster/shared';
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
  /** The signed-in user, after checking the password typed to confirm an account change (403 when wrong). */
  async function confirmedUser(userId: string, currentPassword: string): Promise<AuthUser> {
    const user = await repository.findById(userId);
    if (!user) throw new AppError('User not found.', 404);
    if (!(await crypto.compare(currentPassword, user.passwordHash))) {
      throw new AppError('Current password is incorrect.', 403, undefined, 'WRONG_PASSWORD');
    }
    return user;
  }

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

    async changeEmail(userId: string, input: ChangeEmailRequest): Promise<AuthPublicUser> {
      const user = await confirmedUser(userId, input.currentPassword);
      if (input.email === user.email) return toPublicUser(user);
      try {
        const updated = await repository.update(userId, {email: input.email});
        if (!updated) throw new AppError('User not found.', 404);
        return toPublicUser(updated);
      } catch (error) {
        if (error instanceof AuthEmailAlreadyExistsError) {
          throw new AppError('Email already registered.', 409, undefined, 'ALREADY_EXISTS');
        }
        throw error;
      }
    },

    async changePassword(userId: string, input: ChangePasswordRequest): Promise<void> {
      await confirmedUser(userId, input.currentPassword);
      const passwordHash = await crypto.hash(input.newPassword, HASH_ROUNDS);
      if (!(await repository.update(userId, {passwordHash}))) throw new AppError('User not found.', 404);
    },

    async updateProfile(userId: string, input: UpdateProfileRequest): Promise<AuthPublicUser> {
      const user = await repository.update(userId, input);
      if (!user) throw new AppError('User not found.', 404);
      return toPublicUser(user);
    },
  };
}
