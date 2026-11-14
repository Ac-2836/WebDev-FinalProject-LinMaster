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
      STORAGE_DRIVER: 'local',
      S3_REGION: 'auto',
    });
  });

  it('requires the S3 variables only when STORAGE_DRIVER is s3 or r2', () => {
    expect(() => parseEnv({DATABASE_URL, JWT_SECRET, STORAGE_DRIVER: '', S3_BUCKET: ''})).not.toThrow();
    expect(() => parseEnv({DATABASE_URL, JWT_SECRET, STORAGE_DRIVER: 's3', S3_BUCKET: 'files'})).toThrow(
      /S3_ACCESS_KEY_ID[\s\S]*S3_SECRET_ACCESS_KEY[\s\S]*S3_ENDPOINT/,
    );
    const keys = {S3_ACCESS_KEY_ID: 'b', S3_SECRET_ACCESS_KEY: 'c', S3_BUCKET: 'd'};
    const b2 = {...keys, S3_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com', S3_REGION: 'us-west-004'};
    expect(parseEnv({DATABASE_URL, JWT_SECRET, STORAGE_DRIVER: 's3', ...b2})).toMatchObject(b2);
    // R2 by account id: no endpoint needed, the region defaults to auto.
    const r2 = parseEnv({DATABASE_URL, JWT_SECRET, STORAGE_DRIVER: 'r2', R2_ACCOUNT_ID: 'a', ...keys});
    expect(r2.S3_REGION).toBe('auto');
    expect(() => parseEnv({DATABASE_URL, JWT_SECRET, STORAGE_DRIVER: 'gcs'})).toThrow(/STORAGE_DRIVER/);
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
