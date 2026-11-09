import {z} from 'zod';

/**
 * Error statuses the API sends (Working_rules 8.3), plus the domain statuses thrown with AppError.
 * The client translates each one into a message; add new domain statuses here when a module starts using them.
 */
export const ApiErrorStatus = z.enum([
  'INVALID_ARGUMENT',
  'UNAUTHENTICATED',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'FAILED_PRECONDITION',
  'RESOURCE_EXHAUSTED',
  'INTERNAL',
  'AI_QUOTA_EXCEEDED',
  'AI_INVALID_OUTPUT',
  'AI_UNAVAILABLE',
]);
export type ApiErrorStatus = z.infer<typeof ApiErrorStatus>;

/**
 * Body of every error response: `{error: {code, status, message, details?}}`.
 * `status` stays a plain string so a status the client does not know yet still parses; fall back on `code`.
 */
export const ApiErrorBody = z.object({
  error: z.object({
    code: z.number().int(),
    status: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
