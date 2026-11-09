import {describe, expect, it} from 'vitest';

import {errorKey} from './error-key';

describe('errorKey', () => {
  it('uses a status the client knows', () => {
    expect(errorKey('NOT_FOUND', 404)).toBe('NOT_FOUND');
    expect(errorKey('AI_QUOTA_EXCEEDED', 429)).toBe('AI_QUOTA_EXCEEDED');
  });

  it('falls back on the HTTP code for a module-specific status', () => {
    expect(errorKey('TEST_HAS_ATTEMPTS', 409)).toBe('FAILED_PRECONDITION');
    expect(errorKey('SOMETHING_NEW', 503)).toBe('INTERNAL');
    expect(errorKey('SOMETHING_NEW', 418)).toBe('UNKNOWN');
  });

  it('keeps network failures apart', () => {
    expect(errorKey('NETWORK', 0)).toBe('NETWORK');
  });
});
