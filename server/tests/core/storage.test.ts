import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {errorMiddleware} from '../../src/core/error.middleware';
import {createLocalStorage, MAX_AUDIO_SIZE_BYTES, MAX_PDF_SIZE_BYTES} from '../../src/core/storage';

const pdfData = Buffer.from('%PDF-1.7\nfile test\n');
let directory: string;
let storage: ReturnType<typeof createLocalStorage>;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'linmaster-storage-'));
  storage = createLocalStorage({directory});
});

afterEach(async () => {
  await rm(directory, {recursive: true, force: true});
});

describe('local storage', () => {
  it('stores an uploaded PDF and reads back identical bytes', async () => {
    const stored = await storage.put({
      originalName: 'practice.pdf',
      mimeType: 'application/pdf',
      data: pdfData,
    });

    expect(stored).toMatchObject({
      mimeType: 'application/pdf',
      originalName: 'practice.pdf',
      sizeBytes: pdfData.byteLength,
    });
    await expect(storage.get(stored.key)).resolves.toEqual(pdfData);
  });

  it('detects supported audio MIME from content and accepts the M4A alias', async () => {
    const mp3 = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00');
    const m4a = Buffer.alloc(16);
    m4a.writeUInt32BE(16, 0);
    m4a.write('ftyp', 4, 'ascii');
    m4a.write('M4A ', 8, 'ascii');

    const mp3Stored = await storage.put({originalName: 'lesson.mp3', mimeType: 'audio/mpeg', data: mp3});
    const m4aStored = await storage.put({originalName: 'lesson.m4a', mimeType: 'audio/x-m4a', data: m4a});

    expect(mp3Stored.mimeType).toBe('audio/mpeg');
    expect(m4aStored.mimeType).toBe('audio/mp4');
    await expect(storage.get(mp3Stored.key)).resolves.toEqual(mp3);
    await expect(storage.get(m4aStored.key)).resolves.toEqual(m4a);
  });

  it('returns 415 for an unsupported or mismatched MIME type', async () => {
    const responseApp = express();
    responseApp.post('/upload', express.raw({type: '*/*'}), async (req, res, next) => {
      try {
        const stored = await storage.put({
          originalName: 'upload.bin',
          mimeType: req.header('content-type') ?? '',
          data: req.body as Buffer,
        });
        res.status(201).json(stored);
      } catch (error) {
        next(error);
      }
    });
    responseApp.use(errorMiddleware);

    const response = await request(responseApp).post('/upload').type('text').send('not a supported file');

    expect(response.status).toBe(415);
    expect(response.body.error).toMatchObject({code: 415, status: 'INVALID_ARGUMENT'});
  });

  it('rejects a file that exceeds its MIME-specific size limit', async () => {
    const oversizedPdf = Buffer.concat([pdfData, Buffer.alloc(MAX_PDF_SIZE_BYTES + 1 - pdfData.byteLength)]);

    await expect(
      storage.put({
        originalName: 'oversized.pdf',
        mimeType: 'application/pdf',
        data: oversizedPdf,
      }),
    ).rejects.toMatchObject({statusCode: 413});
    expect(MAX_AUDIO_SIZE_BYTES).toBeGreaterThan(MAX_PDF_SIZE_BYTES);
  });

  it('deletes stored objects and returns null when an object is missing', async () => {
    const stored = await storage.put({originalName: 'practice.pdf', mimeType: 'application/pdf', data: pdfData});

    await storage.delete(stored.key);

    await expect(storage.get(stored.key)).resolves.toBeNull();
  });

  it('rejects unsafe storage keys', async () => {
    await expect(storage.get('../outside-file')).rejects.toMatchObject({statusCode: 400});
  });
});
