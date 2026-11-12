import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import type {Storage} from '../../src/core/storage';
import {setupAttemptsApi} from './attempts-api';

// The fixture audio lasts 1680 s; one byte per second keeps the byte ranges easy to read.
const AUDIO = Buffer.from(Array.from({length: 1680}, (_, index) => index % 256));
const storage: Storage = {
  put: () => Promise.reject(new Error('not used')),
  get: () => Promise.resolve(AUDIO),
  delete: () => Promise.resolve(),
};

describe('attempts API: Listening audio', () => {
  const api = setupAttemptsApi('audio', {storage});
  const {db, start, submit, audio, at, createTest} = api;

  beforeAll(api.setup);
  beforeEach(() => at(0));
  afterAll(api.teardown);

  async function started() {
    const test = await createTest('Audio');
    return (await start(test.id)).body.attempt.id as string;
  }

  it('sends only the bytes played so far by server time, plus a short lead', async () => {
    const id = await started();
    at(10);

    const fromStart = await audio(id);
    const fromPosition = await audio(id, 'bytes=600-');
    const ahead = await audio(id, 'bytes=1000-');

    expect(fromStart.status).toBe(206);
    expect(fromStart.headers['content-range']).toBe('bytes 0-629/1680');
    expect(fromStart.headers['cache-control']).toBe('no-store');
    expect(fromStart.headers['content-type']).toBe('audio/mpeg');
    expect(Buffer.from(fromStart.body).equals(AUDIO.subarray(0, 630))).toBe(true);
    expect(fromPosition.headers['content-range']).toBe('bytes 600-629/1680');
    expect(ahead.status).toBe(416);
    expect(ahead.headers['content-range']).toBe('bytes */1680');
  });

  it('refuses the audio once it ended, in Reading, after submitting and to another user', async () => {
    const id = await started();
    const other = await started();

    const foreign = await audio(id, undefined, api.otherId());
    at(29);
    const ended = await audio(id);
    at(40);
    const reading = await audio(id);
    at(1);
    await submit(other);
    const submitted = await audio(other);

    expect(foreign.status).toBe(403);
    for (const response of [ended, reading, submitted]) {
      expect(response.status).toBe(409);
      expect(response.body.error.status).toBe('AUDIO_NOT_AVAILABLE');
    }
    expect(await db.attempt.count({where: {id: {in: [id, other]}}})).toBe(2);
  });
});
