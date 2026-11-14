import {describe, expect, it} from 'vitest';

import {createR2Storage} from '../../src/core/storage';

const pdf = Buffer.from('%PDF-1.4 sample');

/** In-memory S3: PUT, GET (with Range), DELETE; records every request. */
function fakeS3() {
  const objects = new Map<string, Buffer>();
  const requests: Request[] = [];
  async function fetch(request: Request): Promise<Response> {
    requests.push(request);
    const path = new URL(request.url).pathname;
    if (request.method === 'PUT') {
      objects.set(path, Buffer.from(await request.arrayBuffer()));
      return new Response(null, {status: 200});
    }
    if (request.method === 'DELETE') {
      objects.delete(path);
      return new Response(null, {status: 204});
    }
    const data = objects.get(path);
    if (!data) return new Response('NoSuchKey', {status: 404});
    const range = /bytes=(\d+)-(\d+)/.exec(request.headers.get('range') ?? '');
    if (!range) return new Response(data);
    return new Response(data.subarray(Number(range[1]), Number(range[2]) + 1), {status: 206});
  }
  return {objects, requests, fetch};
}

const options = {accountId: 'acc', accessKeyId: 'id', secretAccessKey: 'secret', bucket: 'linmaster'};

describe('createR2Storage', () => {
  it('stores, reads, reads a byte range and deletes a file through the signed S3 API', async () => {
    const s3 = fakeS3();
    const storage = createR2Storage({...options, fetch: s3.fetch, cacheBytes: 0});

    const stored = await storage.put({mimeType: 'application/pdf', originalName: 'test.pdf', data: pdf});
    expect(stored).toMatchObject({mimeType: 'application/pdf', originalName: 'test.pdf', sizeBytes: pdf.length});
    const put = s3.requests[0];
    expect(put.url).toBe(`https://acc.r2.cloudflarestorage.com/linmaster/${stored.key}`);
    expect(put.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=id\//);
    expect(put.headers.get('content-type')).toBe('application/pdf');

    expect(await storage.get(stored.key)).toEqual(pdf);
    expect(await storage.getRange(stored.key, 1, 4)).toEqual(pdf.subarray(1, 5));
    expect(s3.requests[2].headers.get('range')).toBe('bytes=1-4');

    await storage.delete(stored.key);
    expect(await storage.get(stored.key)).toBeNull();
    expect(await storage.getRange(stored.key, 0, 1)).toBeNull();
  });

  it('keeps read files in memory, and forgets deleted ones', async () => {
    const s3 = fakeS3();
    const storage = createR2Storage({...options, fetch: s3.fetch});
    const {key} = await storage.put({mimeType: 'application/pdf', originalName: 'a.pdf', data: pdf});

    await storage.get(key);
    expect(await storage.get(key)).toEqual(pdf);
    expect(await storage.getRange(key, 0, 3)).toEqual(pdf.subarray(0, 4));
    expect(s3.requests).toHaveLength(2); // PUT, then one GET

    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it('validates like the local driver and rejects bad keys without calling R2', async () => {
    const s3 = fakeS3();
    const storage = createR2Storage({...options, fetch: s3.fetch});
    await expect(
      storage.put({mimeType: 'application/pdf', originalName: 'x.pdf', data: Buffer.from('not a pdf')}),
    ).rejects.toMatchObject({statusCode: 415});
    await expect(storage.get('../secret')).rejects.toMatchObject({statusCode: 400});
    expect(s3.requests).toHaveLength(0);
  });

  it('throws on an R2 error instead of reporting a missing file', async () => {
    const storage = createR2Storage({...options, fetch: async () => new Response('denied', {status: 403})});
    await expect(storage.get('123e4567-e89b-42d3-a456-426614174000')).rejects.toThrow(/HTTP 403/);
  });
});
