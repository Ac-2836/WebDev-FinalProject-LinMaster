export {createLocalStorage, detectMimeType, MAX_AUDIO_SIZE_BYTES, MAX_PDF_SIZE_BYTES} from './local-storage';
export type {LocalStorageOptions} from './local-storage';
export {createS3Storage} from './s3-storage';
export type {S3Storage, S3StorageOptions} from './s3-storage';
export type {Storage, StorageInput, StoredObject} from './storage';

import {storageEnvSchema} from '../config/env';
import {createLocalStorage} from './local-storage';
import {createS3Storage} from './s3-storage';
import type {Storage} from './storage';

let driver: Storage | undefined;

/**
 * The driver named by STORAGE_DRIVER (local by default), chosen on first use so `.env` is loaded by then.
 * Reads only the storage variables, so the seed runs without the server's other variables.
 */
function current(): Storage {
  if (driver) return driver;
  const env = storageEnvSchema.parse(process.env);
  driver =
    env.STORAGE_DRIVER === 'local'
      ? createLocalStorage()
      : createS3Storage({
          endpoint: env.S3_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          region: env.S3_REGION,
          accessKeyId: env.S3_ACCESS_KEY_ID!,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
          bucket: env.S3_BUCKET!,
        });
  return driver;
}

/** Core storage used by the modules and the seed. Tests can still inject another Storage implementation. */
export const storage: Storage = {
  put: input => current().put(input),
  get: key => current().get(key),
  delete: key => current().delete(key),
};
