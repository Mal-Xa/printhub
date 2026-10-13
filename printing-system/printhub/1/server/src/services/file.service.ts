import { getStorage } from '../config/firebase';
import { FileRepository } from '../repositories/file.repository';
import { ActivityLogService } from './activityLog.service';
import { StoredFile } from '../types';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { generateId, nowISO } from '../utils/id';
import { buildDownloadUrl } from '../utils/storageUrl';
import { computePageCount } from '../utils/pageCount';

// ── Service ───────────────────────────────────────────────────────────────────

export const FileService = {
  async upload(
    ownerId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<StoredFile> {
    // Re-uploading a file with the same name replaces the existing one
    // in place instead of creating a duplicate entry in "My Files".
    const existing = await FileRepository.findByOwnerAndName(ownerId, originalName);
    if (existing) {
      const bucket = getStorage().bucket();
      await bucket.file(existing.storagePath).delete({ ignoreNotFound: true });
      await FileRepository.delete(existing.id);
    }

    const id = generateId();
    const ext = originalName.split('.').pop() ?? 'bin';
    const storagePath = `files/${ownerId}/${id}.${ext}`;
    const downloadToken = generateId();

    const bucket = getStorage().bucket();
    const gcsFile = bucket.file(storagePath);

    await gcsFile.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: { ownerId, originalName, firebaseStorageDownloadTokens: downloadToken },
      },
    });

    const pages = await computePageCount(buffer, mimeType, originalName);

    const storedFile: StoredFile = {
      id,
      name: originalName,
      sizeBytes: buffer.length,
      mimeType,
      pages,
      uploadedAt: nowISO(),
      ownerId,
      storagePath,
      downloadToken,
    };

    // Saved once here — the page count is persisted with the file so it
    // never needs to be re-read (e.g. on a later "Reprint").
    await FileRepository.create(storedFile);

    await ActivityLogService.log({
      action: existing ? 'file_replaced' : 'file_uploaded',
      userId: ownerId,
      targetId: id,
      targetType: 'file',
      metadata: { name: originalName, sizeBytes: buffer.length },
    });

    // Attach download URL as `url` to match frontend StoredFile interface
    storedFile.url = buildDownloadUrl(bucket.name, storagePath, downloadToken);
    return storedFile;
  },

  async getById(id: string, requesterId: string, requesterRole: string): Promise<StoredFile> {
    const file = await FileRepository.findById(id);
    if (!file) throw new NotFoundError('File');

    if (requesterRole !== 'admin' && file.ownerId !== requesterId) {
      throw new ForbiddenError('You do not own this file');
    }

    file.url = buildDownloadUrl(getStorage().bucket().name, file.storagePath, file.downloadToken);
    return file;
  },

  async listByUser(userId: string): Promise<StoredFile[]> {
    const files = await FileRepository.findByUser(userId);
    const bucketName = getStorage().bucket().name;
    return files.map(f => {
      f.url = buildDownloadUrl(bucketName, f.storagePath, f.downloadToken);
      return f;
    });
  },

  async listAll(): Promise<StoredFile[]> {
    const files = await FileRepository.findAll();
    const bucketName = getStorage().bucket().name;
    return files.map(f => {
      f.url = buildDownloadUrl(bucketName, f.storagePath, f.downloadToken);
      return f;
    });
  },

  /**
   * Resolves a file's storage location after an ownership check, for streaming
   * the raw bytes back through our own API (avoids relying on the storage
   * bucket having CORS configured for client-side `fetch()`).
   */
  async resolveForStreaming(
    id: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<{ storagePath: string; name: string; mimeType: string }> {
    const file = await FileRepository.findById(id);
    if (!file) throw new NotFoundError('File');

    if (requesterRole !== 'admin' && file.ownerId !== requesterId) {
      throw new ForbiddenError('You do not own this file');
    }

    return { storagePath: file.storagePath, name: file.name, mimeType: file.mimeType };
  },

  async delete(id: string, requesterId: string, requesterRole: string): Promise<void> {
    const file = await FileRepository.findById(id);
    if (!file) throw new NotFoundError('File');

    if (requesterRole !== 'admin' && file.ownerId !== requesterId) {
      throw new ForbiddenError('You do not own this file');
    }

    const bucket = getStorage().bucket();
    await bucket.file(file.storagePath).delete({ ignoreNotFound: true });
    await FileRepository.delete(id);

    await ActivityLogService.log({
      action: 'file_deleted',
      userId: requesterId,
      targetId: id,
      targetType: 'file',
      metadata: { name: file.name },
    });
  },
};
