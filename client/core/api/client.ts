import {ApiErrorBody} from '@linmaster/shared';

import {loginUrl} from '@/core/auth/redirect';
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
}

/**
 * The only way the client calls the server (Working_rules 7.4). Browser only.
 * Adds the JWT, turns error responses into `ApiError`, and on 401 ends the session and goes to the login page.
 */
export async function api<T>(path: string, {method = 'GET', body, signal}: ApiOptions = {}): Promise<T> {
  const token = getToken();
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('NETWORK', 0);
  }

  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;

  const parsed = ApiErrorBody.safeParse(await response.json().catch(() => null));
  const error = parsed.success
    ? new ApiError(parsed.data.error.status, response.status, parsed.data.error.details)
    : new ApiError('INTERNAL', response.status);

  if (response.status === 401 && token) {
    clearToken();
    window.location.assign(loginUrl(window.location.pathname + window.location.search));
  }
  throw error;
}
