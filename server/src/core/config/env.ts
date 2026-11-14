import {z} from 'zod';

// shortcut: lite model while testing on the free tier (gemini-3.5-flash allows only 20 requests a day); choose the production model before deploy.
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

// Treats `KEY=` in .env as unset so defaults apply.
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const optionalText = z.preprocess(emptyToUndefined, z.string().optional());

/**
 * File storage: local disk by default, or any S3-compatible service (STORAGE_DRIVER=s3; r2 is the same driver).
 * S3_ENDPOINT may be left empty for Cloudflare R2 when R2_ACCOUNT_ID is set.
 */
export const storageEnvSchema = z
  .object({
    STORAGE_DRIVER: z.preprocess(emptyToUndefined, z.enum(['local', 's3', 'r2']).default('local')),
    S3_ENDPOINT: z.preprocess(emptyToUndefined, z.url({protocol: /^https?$/}).optional()),
    S3_REGION: z.preprocess(emptyToUndefined, z.string().default('auto')),
    S3_ACCESS_KEY_ID: optionalText,
    S3_SECRET_ACCESS_KEY: optionalText,
    S3_BUCKET: optionalText,
    R2_ACCOUNT_ID: optionalText,
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 'local') return;
    const required = ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET'] as const;
    for (const key of required) {
      if (!env[key]) ctx.addIssue({code: 'custom', path: [key], message: 'Required when STORAGE_DRIVER is s3 or r2'});
    }
    if (!env.S3_ENDPOINT && !env.R2_ACCOUNT_ID) {
      ctx.addIssue({code: 'custom', path: ['S3_ENDPOINT'], message: 'Required unless R2_ACCOUNT_ID is set'});
    }
  });

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url({protocol: /^postgres(ql)?$/}),
  // Optional so tests and CI run without a key; AI calls answer 503 AI_UNAVAILABLE when it is missing.
  GEMINI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  GEMINI_MODEL: z.preprocess(emptyToUndefined, z.string().default(DEFAULT_GEMINI_MODEL)),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform(value => [
      ...new Set(
        value
          .split(',')
          .map(origin => origin.trim())
          .filter(Boolean),
      ),
    ]),
});

const envSchema = baseEnvSchema.and(storageEnvSchema);

export type Env = z.infer<typeof envSchema>;

/** Validates environment variables; throws one readable error listing every invalid variable. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n  ${problems.join('\n  ')}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Parsed `process.env`, validated once. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
