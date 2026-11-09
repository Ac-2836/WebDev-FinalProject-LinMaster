import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {compare, hash} from 'bcryptjs';
import {z} from 'zod';
import {getDb} from '../../core/db';
import {getEnv} from '../../core/config/env';
import {AppError} from '../../core/app-error';
import {catchAsync} from '../../core/catch-async';
import type {ApiModule} from '../../core/module-registry';
import {openApiRegistry} from '../../core/openapi-registry';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import {signJwt} from '../../core/jwt';
import {loginSchema, registerSchema, updateProfileSchema} from './auth.schema';

const HASH_ROUNDS = 12;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS = 10;
const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không chính xác.';

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  locale: 'vi' | 'en';
  targetBand: number | null;
  createdAt: Date;
}

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    locale: 'vi' | 'en';
    targetBand: number | null;
  }): Promise<AuthUser>;
  update(
    id: string,
    input: {
      displayName?: string;
      locale?: 'vi' | 'en';
      targetBand?: number | null;
    },
  ): Promise<AuthUser>;
}

const prismaRepository: AuthRepository = {
  async findByEmail(email) {
    const user = await getDb().user.findUnique({where: {email}});
    return user ? mapPrismaUser(user) : null;
  },
  async findById(id) {
    const user = await getDb().user.findUnique({where: {id}});
    return user ? mapPrismaUser(user) : null;
  },
  async create(input) {
    const user = await getDb().user.create({data: input});
    return mapPrismaUser(user);
  },
  async update(id, input) {
    const user = await getDb().user.update({where: {id}, data: input});
    return mapPrismaUser(user);
  },
};

function mapPrismaUser(user: {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  locale: string;
  targetBand: {toNumber(): number} | null;
  createdAt: Date;
}): AuthUser {
  return {
    ...user,
    locale: user.locale as 'vi' | 'en',
    targetBand: user.targetBand?.toNumber() ?? null,
  };
}

function toPublicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    targetBand: user.targetBand,
    createdAt: user.createdAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

const PublicUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  displayName: z.string(),
  locale: z.enum(['vi', 'en']),
  targetBand: z.number().nullable(),
  createdAt: z.iso.datetime(),
});
const AuthResponseSchema = z.object({token: z.string(), user: PublicUserSchema});
const UserResponseSchema = z.object({user: PublicUserSchema});
const ErrorSchema = z.object({error: z.object({code: z.number(), status: z.string(), message: z.string()})});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  summary: 'Register an account',
  tags: ['Auth'],
  request: {body: {content: {'application/json': {schema: registerSchema.shape.body}}}},
  responses: {
    201: {description: 'Account created.', content: {'application/json': {schema: AuthResponseSchema}}},
    400: {description: 'Invalid request.', content: {'application/json': {schema: ErrorSchema}}},
    409: {description: 'Email is already registered.', content: {'application/json': {schema: ErrorSchema}}},
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Sign in',
  tags: ['Auth'],
  request: {body: {content: {'application/json': {schema: loginSchema.shape.body}}}},
  responses: {
    200: {description: 'Signed in.', content: {'application/json': {schema: AuthResponseSchema}}},
    400: {description: 'Invalid request.', content: {'application/json': {schema: ErrorSchema}}},
    401: {description: 'Invalid email or password.', content: {'application/json': {schema: ErrorSchema}}},
    429: {description: 'Login rate limit exceeded.', content: {'application/json': {schema: ErrorSchema}}},
  },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  summary: 'Get current user profile',
  tags: ['Auth'],
  security: [{bearerAuth: []}],
  responses: {
    200: {description: 'Current profile.', content: {'application/json': {schema: UserResponseSchema}}},
    401: {description: 'Authentication required.', content: {'application/json': {schema: ErrorSchema}}},
  },
});
openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/auth/me',
  summary: 'Update current user profile',
  tags: ['Auth'],
  security: [{bearerAuth: []}],
  request: {body: {content: {'application/json': {schema: updateProfileSchema.shape.body}}}},
  responses: {
    200: {description: 'Updated profile.', content: {'application/json': {schema: UserResponseSchema}}},
    400: {description: 'Invalid request.', content: {'application/json': {schema: ErrorSchema}}},
    401: {description: 'Authentication required.', content: {'application/json': {schema: ErrorSchema}}},
  },
});

export function createAuthModule(repository: AuthRepository, jwtSecret: string): ApiModule {
  const router = Router();
  const loginRateLimit = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_ATTEMPTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        error: {code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.'},
      }),
  });

  router.post(
    '/auth/register',
    validate(registerSchema),
    catchAsync(async (req, res) => {
      const {
        email,
        password,
        displayName,
        locale = 'vi',
        targetBand = null,
      } = req.body as z.infer<typeof registerSchema>['body'];
      const passwordHash = await hash(password, HASH_ROUNDS);
      try {
        const user = await repository.create({email, passwordHash, displayName, locale, targetBand});
        res.status(201).json({token: signJwt(user.id, jwtSecret), user: toPublicUser(user)});
      } catch (error) {
        if (isUniqueConstraintError(error)) throw new AppError('Email này đã được đăng ký.', 409);
        throw error;
      }
    }),
  );

  router.post(
    '/auth/login',
    loginRateLimit,
    validate(loginSchema),
    catchAsync(async (req, res) => {
      const {email, password} = req.body as z.infer<typeof loginSchema>['body'];
      const user = await repository.findByEmail(email);
      const validPassword = user
        ? await compare(password, user.passwordHash)
        : await compare(password, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGyni5lOeF8cY4J9W');
      if (!user || !validPassword) throw new AppError(INVALID_CREDENTIALS, 401);
      res.json({token: signJwt(user.id, jwtSecret), user: toPublicUser(user)});
    }),
  );

  router.get(
    '/auth/me',
    requireAuth(jwtSecret),
    catchAsync(async (req, res) => {
      const user = await repository.findById(req.user!.userId);
      if (!user) throw new AppError('User not found.', 404);
      res.json({user: toPublicUser(user)});
    }),
  );

  router.patch(
    '/auth/me',
    requireAuth(jwtSecret),
    validate(updateProfileSchema),
    catchAsync(async (req, res) => {
      const user = await repository.update(req.user!.userId, req.body as z.infer<typeof updateProfileSchema>['body']);
      res.json({user: toPublicUser(user)});
    }),
  );

  return {name: 'auth', basePath: '/api/v1', router};
}

export const authModule = createAuthModule(prismaRepository, getEnv().JWT_SECRET);
