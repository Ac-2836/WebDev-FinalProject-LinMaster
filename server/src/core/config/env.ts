import {z} from 'zod';

// shortcut: lite model while testing on the free tier (gemini-3.5-flash allows only 20 requests a day); choose the production model before deploy.
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

// Treats `KEY=` in .env as unset so defaults apply.
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
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
