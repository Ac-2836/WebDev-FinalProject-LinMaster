import {describe, expect, it} from 'vitest';

import {parseEnv} from '../../src/core/config/env';

const DATABASE_URL = 'postgresql://linmaster:linmaster@localhost:5432/linmaster_test';

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv({DATABASE_URL})).toEqual({NODE_ENV: 'development', PORT: 4000, DATABASE_URL});
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv({DATABASE_URL, PORT: '5000'}).PORT).toBe(5000);
  });

  it('requires a postgres DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({DATABASE_URL: 'mysql://localhost/x'})).toThrow(/DATABASE_URL/);
  });

  it('lists every invalid variable', () => {
    expect(() => parseEnv({DATABASE_URL, NODE_ENV: 'staging', PORT: 'abc'})).toThrow(/NODE_ENV[\s\S]*PORT/);
  });
});
