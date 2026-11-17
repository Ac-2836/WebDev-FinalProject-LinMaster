import {describe, expect, it} from 'vitest';
import {escapeLike} from '../../src/core/like';

describe('escapeLike', () => {
  it('puts a backslash before the characters LIKE treats as special', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('c:\\dir')).toBe('c:\\\\dir');
    expect(escapeLike('%_\\')).toBe('\\%\\_\\\\');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeLike('environment 2026')).toBe('environment 2026');
    expect(escapeLike('')).toBe('');
  });
});
