import {z} from 'zod';

const passwordSchema = z
  .string()
  .min(8)
  .refine(password => Buffer.byteLength(password, 'utf8') <= 72, {
    message: 'Password must be at most 72 bytes.',
  });
const targetBandSchema = z.number().min(4).max(9).multipleOf(0.5).nullable().optional();

export const registerSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .max(255)
        .pipe(z.email())
        .transform(value => value.toLowerCase()),
      password: passwordSchema,
      displayName: z.string().trim().min(1).max(80),
      locale: z.enum(['vi', 'en']).optional(),
      targetBand: targetBandSchema,
    })
    .strict(),
});

export const loginSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .max(255)
        .pipe(z.email())
        .transform(value => value.toLowerCase()),
      password: passwordSchema,
    })
    .strict(),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      displayName: z.string().trim().min(1).max(80).optional(),
      locale: z.enum(['vi', 'en']).optional(),
      targetBand: targetBandSchema,
    })
    .strict()
    .refine(value => Object.keys(value).length > 0, 'At least one profile field is required.'),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
