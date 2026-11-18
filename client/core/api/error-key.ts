import {ApiErrorStatus} from '@linmaster/shared';

/** Module statuses that are not in `ApiErrorStatus` but have their own message: `AI_REQUEST_REJECTED` (500, a bug on our side, retrying will not help), `SET_EMPTY` (422, publishing a set with no cards). */
const OWN_MESSAGE = ['AI_REQUEST_REJECTED', 'SET_EMPTY'] as const;

/** Message keys under `core.errors`: every ApiErrorStatus plus these. */
export type ErrorKey = ApiErrorStatus | (typeof OWN_MESSAGE)[number] | 'NETWORK' | 'UNKNOWN';

// A module-specific status the client does not translate yet (e.g. TEST_HAS_ATTEMPTS) falls back on the HTTP code.
const BY_HTTP: Record<number, ApiErrorStatus> = {
  400: 'INVALID_ARGUMENT',
  401: 'UNAUTHENTICATED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  409: 'FAILED_PRECONDITION',
  413: 'INVALID_ARGUMENT',
  422: 'FAILED_PRECONDITION',
  429: 'RESOURCE_EXHAUSTED',
};

/** Which translated message to show for a failed call. `httpStatus` is 0 when no response came back. */
export function errorKey(status: string, httpStatus: number): ErrorKey {
  if (status === 'NETWORK') return 'NETWORK';
  const known = ApiErrorStatus.safeParse(status);
  if (known.success) return known.data;
  const own = OWN_MESSAGE.find(key => key === status);
  if (own) return own;
  if (httpStatus >= 500) return 'INTERNAL';
  return BY_HTTP[httpStatus] ?? 'UNKNOWN';
}
