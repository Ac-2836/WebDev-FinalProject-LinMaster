export {createLocalStorage, detectMimeType, MAX_AUDIO_SIZE_BYTES, MAX_PDF_SIZE_BYTES} from './local-storage';
export type {LocalStorageOptions} from './local-storage';
export type {Storage, StorageInput, StoredObject} from './storage';

import {createLocalStorage} from './local-storage';

/** Default core storage driver used locally. Deployments can inject another Storage implementation. */
export const storage = createLocalStorage();
