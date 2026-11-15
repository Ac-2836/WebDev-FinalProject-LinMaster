import {
  ApiErrorBody,
  AuthResponseSchema,
  AuthUserResponseSchema,
  ChangeEmailRequestSchema,
  ChangePasswordRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  UpdateProfileRequestSchema,
} from '@linmaster/shared';
import type {ZodType} from 'zod';
import {openApiRegistry} from '../../core/openapi-registry';

const exampleUser = {
  id: '0192f7e0-0bcd-7000-8000-000000000001',
  email: 'tienhung@example.com',
  displayName: 'Tien Hung',
  locale: 'vi',
  targetBand: 7.5,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const authResponseExample = {token: 'example.jwt.token', user: exampleUser};
const userResponseExample = {user: exampleUser};
const registerRequestExample = {
  email: 'tienhung@example.com',
  password: 'example-password-123',
  displayName: 'Tien Hung',
  locale: 'vi',
  targetBand: 7.5,
};
const loginRequestExample = {email: 'tienhung@example.com', password: 'example-password-123'};

function requestBody(schema: ZodType, exampleName: string, example: unknown) {
  return {
    content: {
      'application/json': {
        schema,
        examples: {[exampleName]: {summary: 'Example request', value: example}},
      },
    },
  };
}

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  summary: 'Register an account',
  tags: ['Auth'],
  request: {body: requestBody(RegisterRequestSchema, 'register', registerRequestExample)},
  responses: {
    201: {
      description: 'Account created.',
      content: {'application/json': {schema: AuthResponseSchema, examples: {success: {value: authResponseExample}}}},
    },
    400: {description: 'Invalid request.', content: {'application/json': {schema: ApiErrorBody}}},
    409: {description: 'Email is already registered.', content: {'application/json': {schema: ApiErrorBody}}},
    429: {description: 'Registration rate limit exceeded.', content: {'application/json': {schema: ApiErrorBody}}},
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Sign in',
  tags: ['Auth'],
  request: {body: requestBody(LoginRequestSchema, 'login', loginRequestExample)},
  responses: {
    200: {
      description: 'Signed in.',
      content: {'application/json': {schema: AuthResponseSchema, examples: {success: {value: authResponseExample}}}},
    },
    400: {description: 'Invalid request.', content: {'application/json': {schema: ApiErrorBody}}},
    401: {description: 'Invalid email or password.', content: {'application/json': {schema: ApiErrorBody}}},
    429: {description: 'Login rate limit exceeded.', content: {'application/json': {schema: ApiErrorBody}}},
  },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  summary: 'Get current user profile',
  tags: ['Auth'],
  security: [{bearerAuth: []}],
  responses: {
    200: {
      description: 'Current profile.',
      content: {
        'application/json': {schema: AuthUserResponseSchema, examples: {success: {value: userResponseExample}}},
      },
    },
    401: {description: 'Authentication required.', content: {'application/json': {schema: ApiErrorBody}}},
    404: {description: 'User not found.', content: {'application/json': {schema: ApiErrorBody}}},
  },
});
openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/auth/me',
  summary: 'Update current user profile',
  tags: ['Auth'],
  security: [{bearerAuth: []}],
  request: {
    body: requestBody(UpdateProfileRequestSchema, 'updateProfile', {
      displayName: 'Tien Hung',
      locale: 'vi',
      targetBand: 7.5,
    }),
  },
  responses: {
    200: {
      description: 'Updated profile.',
      content: {
        'application/json': {schema: AuthUserResponseSchema, examples: {success: {value: userResponseExample}}},
      },
    },
    400: {description: 'Invalid request.', content: {'application/json': {schema: ApiErrorBody}}},
    401: {description: 'Authentication required.', content: {'application/json': {schema: ApiErrorBody}}},
    404: {description: 'User not found.', content: {'application/json': {schema: ApiErrorBody}}},
  },
});

const errorResponse = (description: string) => ({description, content: {'application/json': {schema: ApiErrorBody}}});
const accountErrors = {
  400: errorResponse('Invalid request.'),
  401: errorResponse('Authentication required.'),
  403: errorResponse('`WRONG_PASSWORD`: the current password is incorrect.'),
  404: errorResponse('User not found.'),
  429: errorResponse('Too many attempts (10 per 15 minutes, like login).'),
};

openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/auth/me/email',
  summary: 'Change the email of the current user',
  description:
    'Needs the current password. The email is stored lower-case; an email already used by another account answers 409.',
  tags: ['Auth'],
  security: [{bearerAuth: []}],
  request: {
    body: requestBody(ChangeEmailRequestSchema, 'changeEmail', {
      email: 'new.address@example.com',
      currentPassword: 'safe-password-123',
    }),
  },
  responses: {
    200: {
      description: 'Updated profile.',
      content: {
        'application/json': {schema: AuthUserResponseSchema, examples: {success: {value: userResponseExample}}},
      },
    },
    ...accountErrors,
    409: errorResponse('`ALREADY_EXISTS`: another account uses this email.'),
  },
});

openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/auth/me/password',
  summary: 'Change the password of the current user',
  description:
    'Needs the current password. The new password follows the registration rules (8 characters to 72 bytes).',
  tags: ['Auth'],
  security: [{bearerAuth: []}],
  request: {
    body: requestBody(ChangePasswordRequestSchema, 'changePassword', {
      currentPassword: 'safe-password-123',
      newPassword: 'another-safe-password-456',
    }),
  },
  responses: {204: {description: 'Password changed.'}, ...accountErrors},
});
