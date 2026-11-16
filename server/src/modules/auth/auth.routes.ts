import {Router} from 'express';
import type {Request, Response} from 'express';
import {rateLimit} from 'express-rate-limit';
import type {
  ChangeEmailRequest,
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from '@linmaster/shared';
import {catchAsync} from '../../core/catch-async';
import {requireAuth} from '../../core/require-auth.middleware';
import {validate} from '../../core/validate.middleware';
import {changeEmailSchema, changePasswordSchema, loginSchema, registerSchema, updateProfileSchema} from './auth.schema';
import type {createAuthService} from './auth.service';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS = 10;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
/** Accounts one IP may register per hour. */
const REGISTER_ATTEMPTS = 5;

const rateLimitHandler = (_req: Request, res: Response) =>
  res.status(429).json({
    error: {code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Too many attempts. Please try again later.'},
  });

type AuthService = ReturnType<typeof createAuthService>;

export function createAuthRouter(
  service: AuthService,
  jwtSecret: string,
  registrationsPerHour = REGISTER_ATTEMPTS,
): Router {
  const router = Router();
  const loginRateLimit = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit: LOGIN_ATTEMPTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
  const registerRateLimit = rateLimit({
    windowMs: REGISTER_WINDOW_MS,
    limit: registrationsPerHour,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: rateLimitHandler,
  });

  router.post(
    '/auth/register',
    registerRateLimit,
    validate(registerSchema),
    catchAsync(async (req, res) => {
      const result = await service.register(req.body as RegisterRequest);
      res.status(201).json(result);
    }),
  );
  router.post(
    '/auth/login',
    loginRateLimit,
    validate(loginSchema),
    catchAsync(async (req, res) => {
      res.json(await service.login(req.body as LoginRequest));
    }),
  );
  router.get(
    '/auth/me',
    requireAuth(jwtSecret),
    catchAsync(async (req, res) => {
      res.json({user: await service.getProfile(req.user!.userId)});
    }),
  );
  router.patch(
    '/auth/me',
    requireAuth(jwtSecret),
    validate(updateProfileSchema),
    catchAsync(async (req, res) => {
      res.json({user: await service.updateProfile(req.user!.userId, req.body as UpdateProfileRequest)});
    }),
  );

  // Password checks are limited like login, so the current password cannot be guessed through these routes.
  const accountRateLimit = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit: LOGIN_ATTEMPTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
  router.patch(
    '/auth/me/email',
    requireAuth(jwtSecret),
    accountRateLimit,
    validate(changeEmailSchema),
    catchAsync(async (req, res) => {
      res.json({user: await service.changeEmail(req.user!.userId, req.body as ChangeEmailRequest)});
    }),
  );
  router.patch(
    '/auth/me/password',
    requireAuth(jwtSecret),
    accountRateLimit,
    validate(changePasswordSchema),
    catchAsync(async (req, res) => {
      await service.changePassword(req.user!.userId, req.body as ChangePasswordRequest);
      res.status(204).end();
    }),
  );

  return router;
}

export {REGISTER_ATTEMPTS, REGISTER_WINDOW_MS};
