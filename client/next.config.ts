import path from 'node:path';

import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./core/i18n/request.ts');

/**
 * Basic CSP (P5-02, QA T11). Next.js injects inline scripts and components use inline styles, so both keep
 * 'unsafe-inline'; everything else stays on our origin, plus the API. Exam audio plays from a MediaSource `blob:`.
 * Development adds 'unsafe-eval' and the websocket of hot reload.
 */
export function contentSecurityPolicy(apiUrl: string, development = false): string {
  const api = new URL(apiUrl).origin;
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `media-src 'self' blob: ${api}`,
    `connect-src 'self' ${api}${development ? ' ws:' : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Sent with every page (P5-02). HTTPS (HSTS) is added by Vercel. */
export const SECURITY_HEADERS = [
  {key: 'Content-Security-Policy', value: contentSecurityPolicy(API_URL, process.env.NODE_ENV === 'development')},
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
