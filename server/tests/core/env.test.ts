import {describe, expect, it} from 'vitest';

import {parseEnv} from '../../src/core/config/env';

const DATABASE_URL = 'postgresql://linmaster:linmaster@localhost:5432/linmaster_test';
const JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv({DATABASE_URL, JWT_SECRET})).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      DATABASE_URL,
      GEMINI_MODEL: 'gemini-3.1-flash-lite',
      JWT_SECRET,
      CORS_ORIGINS: ['http://localhost:3000'],
    });
  });

  it('treats empty Gemini variables as unset', () => {
    const env = parseEnv({DATABASE_URL, GEMINI_API_KEY: '', GEMINI_MODEL: '', JWT_SECRET});
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.GEMINI_MODEL).toBe('gemini-3.1-flash-lite');
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv({DATABASE_URL, JWT_SECRET, PORT: '5000'}).PORT).toBe(5000);
  });

  it('requires a postgres DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({DATABASE_URL: 'mysql://localhost/x', JWT_SECRET})).toThrow(/DATABASE_URL/);
  });

  it('lists every invalid variable', () => {
    expect(() => parseEnv({DATABASE_URL, JWT_SECRET, NODE_ENV: 'staging', PORT: 'abc'})).toThrow(/NODE_ENV[\s\S]*PORT/);
  });

  it('requires a strong JWT secret and parses the CORS allowlist', () => {
    expect(() => parseEnv({DATABASE_URL, JWT_SECRET: 'short'})).toThrow(/JWT_SECRET/);
    expect(
      parseEnv({DATABASE_URL, JWT_SECRET, CORS_ORIGINS: 'https://app.example, https://admin.example'}).CORS_ORIGINS,
    ).toEqual(['https://app.example', 'https://admin.example']);
  });
});
