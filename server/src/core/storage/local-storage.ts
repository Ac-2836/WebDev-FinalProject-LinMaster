import {randomUUID} from 'node:crypto';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {AppError} from '../app-error';
import type {Storage, StorageInput, StoredObject} from './storage';

export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_SIZE_BYTES = 60 * 1024 * 1024;

const MAX_SIZE_BY_MIME: Readonly<Record<string, number>> = {
  'application/pdf': MAX_PDF_SIZE_BYTES,
  'audio/mpeg': MAX_AUDIO_SIZE_BYTES,
  'audio/mp4': MAX_AUDIO_SIZE_BYTES,
};
const MIME_ALIASES: Readonly<Record<string, string>> = {'audio/x-m4a': 'audio/mp4'};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LocalStorageOptions {
  directory?: string;
}

/** Detects supported content types from file signatures instead of trusting the filename. */
export function detectMimeType(data: Buffer): string | undefined {
  if (data.length >= 5 && data.subarray(0, 5).equals(Buffer.from('%PDF-'))) return 'application/pdf';
  if (data.length >= 3 && data.toString('ascii', 0, 3) === 'ID3') return 'audio/mpeg';
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (data.length >= 12 && data.toString('ascii', 4, 8) === 'ftyp') return 'audio/mp4';
  return undefined;
}

function normalizeMimeType(mimeType: string): string {
  const baseMimeType = mimeType.split(';', 1)[0].trim().toLowerCase();
  return MIME_ALIASES[baseMimeType] ?? baseMimeType;
}

function validateInput(input: StorageInput): string {
  if (!Buffer.isBuffer(input.data)) throw new AppError('File content must be binary data.', 400);
  if (!input.originalName.trim() || input.originalName.length > 255) {
    throw new AppError('File name must contain between 1 and 255 characters.', 400);
  }

  const declaredMimeType = normalizeMimeType(input.mimeType);
  const detectedMimeType = detectMimeType(input.data);
  const maxSize = detectedMimeType ? MAX_SIZE_BY_MIME[detectedMimeType] : undefined;
  if (!detectedMimeType || !maxSize || declaredMimeType !== detectedMimeType) {
    throw new AppError('Unsupported or mismatched file type.', 415, undefined, 'INVALID_ARGUMENT');
  }
  if (input.data.byteLength > maxSize) {
    throw new AppError('File exceeds the maximum allowed size.', 413);
  }

  return detectedMimeType;
}

function getObjectPath(directory: string, key: string): string {
  if (!UUID_PATTERN.test(key)) throw new AppError('Invalid storage key.', 400);
  const objectPath = path.resolve(directory, key);
  if (path.dirname(objectPath) !== path.resolve(directory)) throw new AppError('Invalid storage key.', 400);
  return objectPath;
}

/** Creates a local storage driver. The default directory is `<server cwd>/uploads`. */
export function createLocalStorage({
  directory = path.resolve(process.cwd(), 'uploads'),
}: LocalStorageOptions = {}): Storage {
  const rootDirectory = path.resolve(directory);

  return {
    async put(input): Promise<StoredObject> {
      const mimeType = validateInput(input);
      await mkdir(rootDirectory, {recursive: true, mode: 0o700});
      const key = randomUUID();
      await writeFile(getObjectPath(rootDirectory, key), input.data, {flag: 'wx', mode: 0o600});
      return {key, mimeType, originalName: input.originalName, sizeBytes: input.data.byteLength};
    },

    async get(key): Promise<Buffer | null> {
      try {
        return await readFile(getObjectPath(rootDirectory, key));
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null;
        throw error;
      }
    },

    async delete(key): Promise<void> {
      await rm(getObjectPath(rootDirectory, key), {force: true});
    },
  };
}
