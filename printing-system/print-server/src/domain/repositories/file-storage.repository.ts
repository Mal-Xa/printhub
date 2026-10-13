import type { FileId } from "print-common";

/** Result of persisting an uploaded document's bytes. */
export interface StoredFile {
  fileId: FileId;
  /** Location the file was stored at, e.g. a filesystem path or bucket URI. */
  storageUri: string;
  sizeBytes: number;
}

/**
 * Port for persisting uploaded document bytes, decoupled from any
 * particular backend (local disk, S3, GCS, ...). The application
 * layer only ever depends on this interface.
 */
export interface FileStorage {
  save(fileId: FileId, fileName: string, buffer: Buffer): Promise<StoredFile>;
  /** Resolves a previously stored file's absolute location, or null if it does not exist. */
  resolve(storageUri: string): Promise<string | null>;
  delete(storageUri: string): Promise<void>;
}
