import {randomUUID} from 'node:crypto';

import {AwsClient} from 'aws4fetch';

import {AppError} from '../app-error';
import {validateInput} from './local-storage';
import type {Storage} from './storage';

export interface R2StorageOptions {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Tests pass a fake S3; defaults to the global fetch. */
  fetch?: (request: Request) => Promise<Response>;
  /** Bytes of recently read files kept in memory (default 64 MB). */
  cacheBytes?: number;
}

export interface R2Storage extends Storage {
  /** Bytes `start..end` (inclusive) of a file, read with an HTTP Range request; null when the file is missing. */
  getRange(key: string, start: number, end: number): Promise<Buffer | null>;
}

const KEY_PATTERN = /^[0-9a-f-]{36}$/i;

/**
 * Cloudflare R2 driver (S3 API, signed with aws4fetch). Same keys and validation as the local driver.
 * Keys are random UUIDs and files are never overwritten, so a read file can be cached safely.
 */
export function createR2Storage({
  accountId,
  accessKeyId,
  secretAccessKey,
  bucket,
  fetch: send = request => fetch(request),
  cacheBytes = 64 * 1024 * 1024,
}: R2StorageOptions): R2Storage {
  const client = new AwsClient({accessKeyId, secretAccessKey, service: 's3', region: 'auto'});
  const bucketUrl = `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}`;
  // shortcut: Storage.get returns the whole file and the audio endpoint calls it on every Range request, so recent
  // files stay in memory; add getRange to the Storage interface if many large files are played at once.
  const cache = new Map<string, Buffer>();
  let cachedBytes = 0;

  function remember(key: string, data: Buffer) {
    if (data.byteLength > cacheBytes) return;
    cache.set(key, data);
    cachedBytes += data.byteLength;
    for (const [oldKey, old] of cache) {
      if (cachedBytes <= cacheBytes) break;
      cache.delete(oldKey);
      cachedBytes -= old.byteLength;
    }
  }

  function forget(key: string) {
    const data = cache.get(key);
    if (data) cachedBytes -= data.byteLength;
    cache.delete(key);
  }

  async function request(key: string, init: RequestInit = {}): Promise<Response> {
    if (!KEY_PATTERN.test(key)) throw new AppError('Invalid storage key.', 400);
    const response = await send(await client.sign(`${bucketUrl}/${key}`, init));
    if (!response.ok && response.status !== 404) {
      throw new Error(`R2 ${init.method ?? 'GET'} failed with HTTP ${response.status}.`);
    }
    return response;
  }

  async function body(response: Response): Promise<Buffer | null> {
    return response.status === 404 ? null : Buffer.from(await response.arrayBuffer());
  }

  return {
    async put(input) {
      const mimeType = validateInput(input);
      const key = randomUUID();
      await request(key, {method: 'PUT', body: input.data, headers: {'Content-Type': mimeType}});
      return {key, mimeType, originalName: input.originalName, sizeBytes: input.data.byteLength};
    },

    async get(key) {
      const hit = cache.get(key);
      if (hit) return hit;
      const data = await body(await request(key));
      if (data) remember(key, data);
      return data;
    },

    async getRange(key, start, end) {
      const hit = cache.get(key);
      if (hit) return hit.subarray(start, end + 1);
      return body(await request(key, {headers: {Range: `bytes=${start}-${end}`}}));
    },

    async delete(key) {
      forget(key);
      await request(key, {method: 'DELETE'});
    },
  };
}
