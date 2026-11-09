import {TOKEN_COOKIE} from './redirect';

// Same lifetime as the JWT the server signs (P1-04: 1 hour, no refresh token).
const MAX_AGE = 60 * 60;

/** Browser only. */
export function getToken() {
  const entry = document.cookie.split('; ').find(c => c.startsWith(`${TOKEN_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(TOKEN_COOKIE.length + 1)) : undefined;
}

export function setToken(token: string) {
  writeCookie(encodeURIComponent(token), MAX_AGE);
}

export function clearToken() {
  writeCookie('', 0);
}

function writeCookie(value: string, maxAge: number) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${TOKEN_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}
