import { getStorage } from '../config/firebase';
import { PassportRepository } from '../repositories/passport.repository';
import { ActivityLogService } from './activityLog.service';
import { PassportSheet } from '../types';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { generateId, nowISO } from '../utils/id';
import { env } from '../config/env';
import { CreatePassportInput } from '../validators/passport.validator';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildSignedUrl(storagePath: string): Promise<string> {
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const expiresAt = Date.now() + env.signedUrlExpiryMinutes * 60 * 1000;
  const [url] = await file.getSignedUrl({ action: 'read', expires: expiresAt });
  return url;
}

/**
 * Accepts a base64 data URL (data:image/jpeg;base64,...) or a plain URL string.
 * If it's a data URL, uploads the raw bytes to Firebase Storage and returns
 * the storage path + a signed URL.
 * If it's already an http/https URL, returns it as-is with no storage path.
 */
async function handlePhotoUrl(
  photoUrl: string,
  userId: string,
  id: string,
): Promise<{ storagePath?: string; resolvedUrl: string }> {
  if (!photoUrl.startsWith('data:')) {
    return { resolvedUrl: photoUrl };
  }

  // Parse data URL: data:<mimeType>;base64,<data>
  const [header, base64Data] = photoUrl.split(',');
  if (!header || !base64Data) return { resolvedUrl: photoUrl };

  const mimeMatch = header.match(/data:([^;]+)/);
  const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
  const ext = mimeType.split('/').pop() ?? 'jpg';
  const storagePath = `passport/${userId}/${id}/photo.${ext}`;

  const buffer = Buffer.from(base64Data, 'base64');
  const bucket = getStorage().bucket();
  await bucket.file(storagePath).save(buffer, {
    metadata: { contentType: mimeType },
  });

  const resolvedUrl = await buildSignedUrl(storagePath);
  return { storagePath, resolvedUrl };
}

// ── Service ───────────────────────────────────────────────────────────────────

export const PassportService = {
  /**
   * Create a passport sheet record.
   * The frontend sends a JSON body — `photoUrl` may be a canvas-generated
   * data URL (base64) which we upload to Firebase Storage, or it may be
   * omitted entirely for a sheet-only record.
   */
  async create(input: CreatePassportInput, userId: string): Promise<PassportSheet> {
    const id = generateId();
    let photoUrl: string | undefined;
    let photoPath: string | undefined;

    if (input.photoUrl) {
      const { storagePath, resolvedUrl } = await handlePhotoUrl(input.photoUrl, userId, id);
      photoUrl = resolvedUrl;
      photoPath = storagePath;
    }

    const sheet: PassportSheet = {
      id,
      userId,
      template: input.template,
      photoUrl,
      photoPath,
      photosPerSheet: input.photosPerSheet,
      createdAt: nowISO(),
    };

    await PassportRepository.create(sheet);

    await ActivityLogService.log({
      action: 'passport_created',
      userId,
      targetId: id,
      targetType: 'passportSheet',
      metadata: { template: input.template, photosPerSheet: input.photosPerSheet },
    });

    // Return without internal storage path
    const { photoPath: _path, ...clientSheet } = sheet;
    return clientSheet;
  },

  async listForUser(userId: string): Promise<PassportSheet[]> {
    const sheets = await PassportRepository.findByUser(userId);
    return sheets.map(({ photoPath: _path, ...s }) => s);
  },

  async listAll(): Promise<PassportSheet[]> {
    const sheets = await PassportRepository.findAll();
    return sheets.map(({ photoPath: _path, ...s }) => s);
  },

  async delete(id: string, requesterId: string, requesterRole: string): Promise<void> {
    const sheet = await PassportRepository.findById(id);
    if (!sheet) throw new NotFoundError('Passport sheet');

    if (requesterRole !== 'admin' && sheet.userId !== requesterId) {
      throw new ForbiddenError('You do not own this passport sheet');
    }

    if (sheet.photoPath) {
      const bucket = getStorage().bucket();
      await bucket.file(sheet.photoPath).delete({ ignoreNotFound: true });
    }

    await PassportRepository.delete(id);

    await ActivityLogService.log({
      action: 'passport_deleted',
      userId: requesterId,
      targetId: id,
      targetType: 'passportSheet',
    });
  },
};
