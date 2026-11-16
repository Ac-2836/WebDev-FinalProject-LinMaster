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

const errorResponse = (description: string) => ({description, content: {'application/json': {schema: ApiErrorBody}}});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  summary: 'Register an account',
  description:
    'Creates the account and signs it in: `token` is a JWT valid for 1 hour. The password needs 8 characters ' +
    '(at most 72 bytes); the email is stored in lower case. 5 registrations per hour per IP.',
  tags: ['Auth'],
  request: {body: requestBody(RegisterRequestSchema, 'register', registerRequestExample)},
  responses: {
    201: {
      description: 'Account created.',
      content: {'application/json': {schema: AuthResponseSchema, examples: {success: {value: authResponseExample}}}},
    },
    400: {description: 'Invalid request.', content: {'application/json': {schema: ApiErrorBody}}},
    409: errorResponse('`ALREADY_EXISTS`: the email is already registered.'),
    429: errorResponse('More than 5 registrations in an hour from this IP.'),
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Sign in',
  description:
    'Returns a new `token` (JWT, 1 hour). A wrong email and a wrong password give the same 401, so the answer ' +
    'does not tell which accounts exist. 10 tries per 15 minutes per IP.',
  tags: ['Auth'],
  request: {body: requestBody(LoginRequestSchema, 'login', loginRequestExample)},
  responses: {
    200: {
      description: 'Signed in.',
      content: {'application/json': {schema: AuthResponseSchema, examples: {success: {value: authResponseExample}}}},
    },
    400: {description: 'Invalid request.', content: {'application/json': {schema: ApiErrorBody}}},
    401: errorResponse('Email or password is incorrect.'),
    429: errorResponse('More than 10 sign-in tries in 15 minutes from this IP.'),
  },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  summary: 'Get current user profile',
  description: 'The account of the token: email, display name, interface language and target IELTS band.',
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
  description:
    'Changes any of `displayName`, `locale` (`vi` or `en`) and `targetBand` (4 to 9 in steps of 0.5, or null). ' +
    'Fields left out stay as they are. Email and password have their own routes, which ask for the password.',
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
