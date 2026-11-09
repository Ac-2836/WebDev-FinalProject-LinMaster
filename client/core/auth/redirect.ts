// Pure helpers shared by the route guard (proxy.ts), the session and the login page. No Next imports, so they unit-test.

/** Cookie that holds the JWT. Readable by JS so the API client can send it as `Authorization: Bearer`. */
export const TOKEN_COOKIE = 'lm_token';

/** Pages anyone can open. Every other page needs a session. */
const PUBLIC_PATHS = new Set(['/', '/login', '/register']);

export const HOME_PATH = '/home';

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

/** `/login?next=<path>`; keeps `/` readable so the URL looks like `/login?next=/home`. */
export function loginUrl(next: string) {
  return `/login?next=${encodeURIComponent(next).replace(/%2F/g, '/')}`;
}

/** Where to go after login. Only same-site paths are allowed, so `next` cannot send users to another site. */
export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return HOME_PATH;
  return next;
}
