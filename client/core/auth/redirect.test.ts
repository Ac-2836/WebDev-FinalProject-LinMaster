import {describe, expect, it} from 'vitest';

import {isPublicPath, loginUrl, safeNext} from './redirect';

describe('loginUrl', () => {
  it('keeps the path readable', () => {
    expect(loginUrl('/home')).toBe('/login?next=/home');
  });

  it('encodes the query of the original page', () => {
    expect(loginUrl('/tests?tab=mine&page=2')).toBe('/login?next=/tests%3Ftab%3Dmine%26page%3D2');
  });
});

describe('safeNext', () => {
  it('accepts same-site paths', () => {
    expect(safeNext('/home')).toBe('/home');
    expect(safeNext('/tests?tab=mine')).toBe('/tests?tab=mine');
  });

  it.each([null, undefined, '', 'home', 'https://evil.example', '//evil.example', '/\\evil.example'])(
    'falls back to /home for %s',
    next => {
      expect(safeNext(next)).toBe('/home');
    },
  );
});

describe('isPublicPath', () => {
  it('only lets the landing and auth pages through', () => {
    expect(['/', '/login', '/register'].every(isPublicPath)).toBe(true);
    expect(['/home', '/read', '/login/extra'].some(isPublicPath)).toBe(false);
  });
});
