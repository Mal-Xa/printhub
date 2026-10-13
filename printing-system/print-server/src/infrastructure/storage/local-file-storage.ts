import { promises as fs } from "node:fs";
import path from "node:path";
import type { FileId } from "print-common";
import type { FileStorage, StoredFile } from "../../domain/repositories";
import type { Logger } from "../logging/logger";

/**
 * Local filesystem `FileStorage` implementation. Stores each document
 * under `<uploadDir>/<fileId>__<sanitizedFileName>`. Swap for an S3 or
 * GCS-backed implementation by implementing the same `FileStorage`
 * interface -- upload/print flows would not need to change.
 */
export class LocalFileStorage implements FileStorage {
  constructor(
    private readonly uploadDir: string,
    private readonly logger: Logger
  ) {}

  async init(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  async save(fileId: FileId, fileName: string, buffer: Buffer): Promise<StoredFile> {
    const safeName = this.sanitizeFileName(fileName);
    const storedName = `${fileId}__${safeName}`;
    const fullPath = path.join(this.uploadDir, storedName);

    await fs.writeFile(fullPath, buffer);
    this.logger.debug({ fileId, fullPath, sizeBytes: buffer.length }, "Stored uploaded file");

    return {
      fileId,
      storageUri: `file://${fullPath}`,
      sizeBytes: buffer.length,
    };
  }

  async resolve(storageUri: string): Promise<string | null> {
    const fullPath = this.toFsPath(storageUri);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      return null;
    }
  }

  async delete(storageUri: string): Promise<void> {
    const fullPath = this.toFsPath(storageUri);
    await fs.rm(fullPath, { force: true });
  }

  private toFsPath(storageUri: string): string {
    return storageUri.startsWith("file://") ? storageUri.slice("file://".length) : storageUri;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  }
}
