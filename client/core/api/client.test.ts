import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {api, ApiError, isAiRejected, isNotFound} from './client';

const assign = vi.fn();
let cookie = '';

beforeEach(() => {
  cookie = 'lm_token=abc';
  const location = {pathname: '/tests', search: '?tab=mine', protocol: 'http:', assign};
  vi.stubGlobal('location', location);
  vi.stubGlobal('window', {location});
  vi.stubGlobal('document', {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      cookie = value.includes('Max-Age=0') ? '' : value;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  assign.mockReset();
});

const reply = (status: number, body?: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), {status})),
  );

describe('api', () => {
  it('treats 200 and 201 as success alike (copying a set again returns the copy that exists)', async () => {
    for (const status of [200, 201]) {
      reply(status, {setId: 'copy'});
      await expect(api('/library/sets/x/copy', {method: 'POST'})).resolves.toEqual({setId: 'copy'});
    }
  });

  it('knows the AI refused our request', async () => {
    reply(500, {error: {code: 500, status: 'AI_REQUEST_REJECTED', message: 'x'}});
    const error = await api('/vocab/lookups', {method: 'POST'}).catch((e: unknown) => e);
    expect(isAiRejected(error)).toBe(true);
    expect(isAiRejected(new ApiError('INTERNAL', 500))).toBe(false);
  });

  it('sends the JWT and a JSON body', async () => {
    reply(200, {ok: true});
    await expect(api('/tests', {method: 'POST', body: {a: 1}})).resolves.toEqual({ok: true});
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/v1/tests');
    expect(init?.headers).toEqual({Authorization: 'Bearer abc', 'Content-Type': 'application/json'});
    expect(init?.body).toBe('{"a":1}');
  });

  it('returns undefined for 204', async () => {
    reply(204);
    await expect(api('/tests/1', {method: 'DELETE'})).resolves.toBeUndefined();
  });

  it('throws ApiError with the server status', async () => {
    reply(409, {error: {code: 409, status: 'TEST_HAS_ATTEMPTS', message: 'x', details: {n: 2}}});
    await expect(api('/tests/1')).rejects.toMatchObject({
      status: 'TEST_HAS_ATTEMPTS',
      httpStatus: 409,
      details: {n: 2},
    });
  });

  it('treats a body that is not the error envelope as INTERNAL', async () => {
    reply(502, '<html>');
    await expect(api('/tests')).rejects.toMatchObject({status: 'INTERNAL', httpStatus: 502});
  });

  it('ends the session and goes to login on 401', async () => {
    reply(401, {error: {code: 401, status: 'UNAUTHENTICATED', message: 'x'}});
    await expect(api('/tests')).rejects.toBeInstanceOf(ApiError);
    expect(cookie).toBe('');
    expect(assign).toHaveBeenCalledWith('/login?next=/tests%3Ftab%3Dmine');
  });

  it('stays on the login page on 401 so the form can show a wrong password', async () => {
    window.location.pathname = '/login';
    reply(401, {error: {code: 401, status: 'UNAUTHENTICATED', message: 'x'}});
    await expect(api('/auth/login', {method: 'POST', body: {}})).rejects.toMatchObject({status: 'UNAUTHENTICATED'});
    expect(cookie).toBe('');
    expect(assign).not.toHaveBeenCalled();
  });

  it('reports NETWORK when no response comes back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/tests')).rejects.toMatchObject({status: 'NETWORK', httpStatus: 0});
  });
});

describe('isNotFound', () => {
  it('reads a missing, foreign or malformed id as not found, and nothing else', () => {
    for (const http of [400, 403, 404]) expect(isNotFound(new ApiError('X', http))).toBe(true);
    for (const http of [0, 401, 409, 500, 503]) expect(isNotFound(new ApiError('X', http))).toBe(false);
    expect(isNotFound(new Error('boom'))).toBe(false);
  });
});
