import {type NextRequest, NextResponse} from 'next/server';

import {isPublicPath, loginUrl, TOKEN_COOKIE} from '@/core/auth/redirect';

/**
 * Route guard (PLAN C0): pages that need a session send signed-out visitors to `/login?next=<page>`.
 * Optimistic check on the cookie only; an expired token is caught by the API client on the first 401.
 */
export function proxy(request: NextRequest) {
  const {pathname, search} = request.nextUrl;
  if (isPublicPath(pathname) || request.cookies.has(TOKEN_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL(loginUrl(pathname + search), request.url));
}

// Skip Next internals and files with an extension (icon.svg, images).
export const config = {matcher: ['/((?!_next/|.*\\..*).*)']};
