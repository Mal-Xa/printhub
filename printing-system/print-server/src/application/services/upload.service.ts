import { randomUUID } from "node:crypto";
import {
  asFileId,
  SUPPORTED_MIME_TYPES,
  type DocumentRef,
  type FileId,
  type UploadRequest,
  type UploadResponse,
} from "print-common";
import { NotFoundError, UnsupportedFileTypeError, UploadTooLargeError } from "../../domain/errors";
import type { FileStorage, UploadedFileRepository } from "../../domain/repositories";
import type { Logger } from "../../infrastructure/logging/logger";

/** Result needed by the HTTP layer to stream a previously uploaded file back out. */
export interface ResolvedFileDownload {
  fsPath: string;
  fileName: string;
  mimeType: string;
}

/**
 * Handles document upload prior to printing: validates the file,
 * persists its bytes via `FileStorage`, and records its metadata in
 * `UploadedFileRepository` so a later `PrintRequest` can reference it
 * by `fileId`. Also resolves previously uploaded files back to a
 * streamable path so print-agent (running on a different machine) can
 * download job documents over HTTP.
 */
export class UploadService {
  constructor(
    private readonly fileStorage: FileStorage,
    private readonly uploadedFileRepository: UploadedFileRepository,
    private readonly maxDocumentSizeBytes: number,
    private readonly publicBaseUrl: string,
    private readonly logger: Logger
  ) {}

  /**
   * The fully-qualified URL print-agent/print-client use to fetch this
   * file's bytes. Kept separate from the internal `file://` URI
   * `FileStorage` uses for its own bookkeeping -- that one never
   * leaves this service.
   */
  private toPublicStorageUri(fileId: FileId): string {
    return `${this.publicBaseUrl}/api/files/${fileId}`;
  }

  async upload(request: UploadRequest, buffer: Buffer): Promise<UploadResponse> {
    if (!SUPPORTED_MIME_TYPES.includes(request.mimeType)) {
      throw new UnsupportedFileTypeError(request.mimeType);
    }
    if (request.sizeBytes > this.maxDocumentSizeBytes) {
      throw new UploadTooLargeError(request.sizeBytes, this.maxDocumentSizeBytes);
    }
    if (buffer.length > this.maxDocumentSizeBytes) {
      throw new UploadTooLargeError(buffer.length, this.maxDocumentSizeBytes);
    }

    const fileId = asFileId(randomUUID());
    const stored = await this.fileStorage.save(fileId, request.fileName, buffer);
    const uploadedAt = new Date().toISOString();

    await this.uploadedFileRepository.save({
      fileId,
      fileName: request.fileName,
      mimeType: request.mimeType,
      sizeBytes: stored.sizeBytes,
      storageUri: stored.storageUri,
    });

    this.logger.info({ fileId, ownerId: request.ownerId }, "File uploaded");

    return {
      fileId,
      storageUri: this.toPublicStorageUri(fileId),
      uploadedAt,
    };
  }

  /** Resolves a previously uploaded file's metadata + on-disk path for streaming back to a caller (e.g. print-agent). */
  async getFileForDownload(fileId: FileId): Promise<ResolvedFileDownload> {
    const record = await this.uploadedFileRepository.findById(fileId);
    if (!record) throw new NotFoundError("Uploaded document", fileId);

    const fsPath = await this.fileStorage.resolve(record.storageUri);
    if (!fsPath) throw new NotFoundError("Uploaded document", fileId);

    return { fsPath, fileName: record.fileName, mimeType: record.mimeType };
  }

  /** Returns a DocumentRef with the internal storageUri swapped for the public, fetchable URL. Used by JobService when embedding a document into a new PrintJob. */
  async getPublicDocumentRef(fileId: FileId): Promise<DocumentRef | null> {
    const record = await this.uploadedFileRepository.findById(fileId);
    if (!record) return null;
    return { ...record, storageUri: this.toPublicStorageUri(fileId) };
  }
}
