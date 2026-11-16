import {describe, expect, it} from 'vitest';

import nextConfig, {contentSecurityPolicy, SECURITY_HEADERS} from '../../next.config';

describe('security headers of the web app', () => {
  it('sends the security headers on every page and hides the framework', async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(await nextConfig.headers?.()).toEqual([{source: '/:path*', headers: SECURITY_HEADERS}]);
    expect(Object.fromEntries(SECURITY_HEADERS.map(({key, value}) => [key, value]))).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
  });

  it('lets the pages reach only the API, and play exam audio from a blob', () => {
    const csp = contentSecurityPolicy('https://linmaster-api.onrender.com/api/v1');
    expect(csp).toContain("connect-src 'self' https://linmaster-api.onrender.com;");
    expect(csp).toContain("media-src 'self' blob: https://linmaster-api.onrender.com;");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-eval');
    expect(contentSecurityPolicy('http://localhost:4000/api/v1', true)).toContain("'unsafe-eval'");
  });
});
