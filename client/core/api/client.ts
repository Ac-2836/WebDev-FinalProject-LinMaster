import {ApiErrorBody} from '@linmaster/shared';

import {isAuthPath, loginUrl} from '@/core/auth/redirect';
import {clearToken, getToken} from '@/core/auth/token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Every failed call throws this. Show it with `useErrorMessage()`, never with the server's own text. */
export class ApiError extends Error {
  constructor(
    /** Server `error.status` as sent (may be module-specific), or `NETWORK` when no response came back. */
    readonly status: string,
    /** HTTP status, 0 for `NETWORK`. */
    readonly httpStatus: number,
    readonly details?: unknown,
  ) {
    super(status);
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON-encoded, except `FormData` (file uploads) which is sent as is. */
  body?: unknown;
  signal?: AbortSignal;
  /** Extra request headers, e.g. `Range` for the exam audio. */
  headers?: Record<string, string>;
  /** Lets the request finish after the page unloads (the exam room's last autosave). */
  keepalive?: boolean;
}

/**
 * The raw response, for bodies that are not JSON (the exam audio stream). Adds the JWT and, on 401, ends the
 * session and goes to the login page like `api`. Throws `ApiError('NETWORK')` when no response came back.
 */
export async function apiResponse(
  path: string,
  {method = 'GET', body, signal, headers: extra, keepalive}: ApiOptions = {},
): Promise<Response> {
  const token = getToken();
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = {...extra};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
      keepalive,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('NETWORK', 0);
  }

  if (response.status === 401 && token) {
    clearToken();
    // On the login page a 401 is a wrong password, not an expired session: stay so the form can show the error.
    if (!isAuthPath(window.location.pathname)) {
      window.location.assign(loginUrl(window.location.pathname + window.location.search));
    }
  }
  return response;
}

/**
 * The only way the client calls the server (Working_rules 7.4). Browser only.
 * Adds the JWT, turns error responses into `ApiError`, and on 401 ends the session and goes to the login page.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await apiResponse(path, options);
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;

  const parsed = ApiErrorBody.safeParse(await response.json().catch(() => null));
  throw parsed.success
    ? new ApiError(parsed.data.error.status, response.status, parsed.data.error.details)
    : new ApiError('INTERNAL', response.status);
}
