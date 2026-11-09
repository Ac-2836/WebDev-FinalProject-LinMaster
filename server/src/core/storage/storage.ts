export interface StorageInput {
  /** Original client-provided MIME type. The driver verifies it against the file signature. */
  mimeType: string;
  originalName: string;
  data: Buffer;
}

export interface StoredObject {
  key: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
}

export interface Storage {
  put(input: StorageInput): Promise<StoredObject>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}
