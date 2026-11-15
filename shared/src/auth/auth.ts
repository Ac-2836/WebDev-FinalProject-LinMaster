import {z} from 'zod';

const emailSchema = z
  .string()
  .trim()
  .max(255)
  .pipe(z.email())
  .transform(value => value.toLowerCase());
const passwordSchema = z
  .string()
  .min(8)
  .refine(password => new TextEncoder().encode(password).length <= 72, {
    message: 'Password must be at most 72 bytes.',
  });
const targetBandSchema = z.number().min(4).max(9).multipleOf(0.5).nullable().optional();

export const RegisterRequestSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z.string().trim().min(1).max(80),
    locale: z.enum(['vi', 'en']).optional(),
    targetBand: targetBandSchema,
  })
  .strict();

export const LoginRequestSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const UpdateProfileRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    locale: z.enum(['vi', 'en']).optional(),
    targetBand: targetBandSchema,
  })
  .strict()
  .refine(value => Object.keys(value).length > 0, 'At least one profile field is required.');

/** The password the user types to confirm an account change; only compared, so any non-empty string. */
const currentPasswordSchema = z.string().min(1).max(200);

/** `PATCH /auth/me/email`. */
export const ChangeEmailRequestSchema = z.object({email: emailSchema, currentPassword: currentPasswordSchema}).strict();

/** `PATCH /auth/me/password`: the new password follows the registration rules. */
export const ChangePasswordRequestSchema = z
  .object({currentPassword: currentPasswordSchema, newPassword: passwordSchema})
  .strict();

/** `WRONG_PASSWORD` (403): the current password typed to confirm an email or password change is wrong. */
export const AuthErrorStatusSchema = z.enum(['WRONG_PASSWORD']);

export const AuthPublicUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  displayName: z.string(),
  locale: z.enum(['vi', 'en']),
  targetBand: z.number().nullable(),
  createdAt: z.iso.datetime(),
});

export const AuthResponseSchema = z.object({token: z.string(), user: AuthPublicUserSchema});
export const AuthUserResponseSchema = z.object({user: AuthPublicUserSchema});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type ChangeEmailRequest = z.infer<typeof ChangeEmailRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
export type AuthPublicUser = z.infer<typeof AuthPublicUserSchema>;
