import {describe, expect, it} from 'vitest';

import {parseEnv} from '../../src/core/config/env';

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv({})).toEqual({NODE_ENV: 'development', PORT: 4000});
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv({PORT: '5000'}).PORT).toBe(5000);
  });

  it('lists every invalid variable', () => {
    expect(() => parseEnv({NODE_ENV: 'staging', PORT: 'abc'})).toThrow(/NODE_ENV[\s\S]*PORT/);
  });
});
