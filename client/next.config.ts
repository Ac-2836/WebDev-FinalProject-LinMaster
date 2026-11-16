import path from 'node:path';

import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./core/i18n/request.ts');

/** Sent with every page (P5-02). HTTPS (HSTS) is added by Vercel; a CSP is left out so Next.js inline scripts work. */
export const SECURITY_HEADERS = [
  {key: 'X-Content-Type-Options', value: 'nosniff'},
  // The app is never shown inside a frame of another site (clickjacking).
  {key: 'X-Frame-Options', value: 'DENY'},
  {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
  {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
];

const nextConfig: NextConfig = {
  // Monorepo: dependencies are hoisted to the repo root.
  turbopack: {root: path.join(__dirname, '..')},
  poweredByHeader: false,
  async headers() {
    return [{source: '/:path*', headers: SECURITY_HEADERS}];
  },
};

export default withNextIntl(nextConfig);
