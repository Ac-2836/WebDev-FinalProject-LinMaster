import {describe, expect, it} from 'vitest';

import nextConfig, {SECURITY_HEADERS} from '../../next.config';

describe('security headers of the web app', () => {
  it('sends the security headers on every page and hides the framework', async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(await nextConfig.headers?.()).toEqual([{source: '/:path*', headers: SECURITY_HEADERS}]);
    expect(Object.fromEntries(SECURITY_HEADERS.map(({key, value}) => [key, value]))).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });
  });
});
