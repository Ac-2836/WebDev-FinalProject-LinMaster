import {describe, expect, it} from 'vitest';

import {passwordStrength} from './register-page';

describe('passwordStrength', () => {
  it.each([
    ['', 0],
    ['abcdefgh', 1],
    ['abcd1234', 2],
    ['abcdefghijkl', 2],
    ['abcdefgh1234', 3],
  ])('%s → %i bars', (password, bars) => {
    expect(passwordStrength(password)).toBe(bars);
  });
});
