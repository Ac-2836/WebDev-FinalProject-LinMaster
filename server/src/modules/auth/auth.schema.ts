import {LoginRequestSchema, RegisterRequestSchema, UpdateProfileRequestSchema} from '@linmaster/shared';
import {z} from 'zod';

export const registerSchema = z.object({body: RegisterRequestSchema});
export const loginSchema = z.object({body: LoginRequestSchema});
export const updateProfileSchema = z.object({body: UpdateProfileRequestSchema});

export type RegisterInput = z.infer<typeof RegisterRequestSchema>;
export type LoginInput = z.infer<typeof LoginRequestSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileRequestSchema>;
