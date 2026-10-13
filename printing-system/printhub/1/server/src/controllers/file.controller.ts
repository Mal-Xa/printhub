import { Request, Response, NextFunction } from 'express';
import { FileService } from '../services/file.service';
import { getStorage } from '../config/firebase';
import { AuthenticatedRequest } from '../types';
import { ok, created, noContent } from '../utils/response';
import { BadRequestError, NotFoundError } from '../utils/errors';

export const FileController = {
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const file = req.file;
      if (!file) throw new BadRequestError('No file provided');

      const stored = await FileService.upload(uid, file.buffer, file.originalname, file.mimetype);
      created(res, stored, 'File uploaded successfully');
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid, role } = (req as AuthenticatedRequest).user;
      const files = role === 'admin' ? await FileService.listAll() : await FileService.listByUser(uid);
      ok(res, files);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid, role } = (req as AuthenticatedRequest).user;
      const file = await FileService.getById(req.params['id']!, uid, role);
      ok(res, file);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/files/:id/content — streams the file's raw bytes through our own
   * API (authenticated), instead of relying on the client hitting Firebase
   * Storage's `firebasestorage.googleapis.com` URL directly, which requires
   * the bucket to have CORS configured for `fetch()`/`XMLHttpRequest` reads.
   *
   * `?disposition=attachment` (used for "Download") forces a save-as dialog;
   * omitting it (used for "View") lets the browser render the file inline.
   */
  async getContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid, role } = (req as AuthenticatedRequest).user;
      const { storagePath, name, mimeType } = await FileService.resolveForStreaming(
        req.params['id']!,
        uid,
        role,
      );

      const bucket = getStorage().bucket();
      const gcsFile = bucket.file(storagePath);
      const [exists] = await gcsFile.exists();
      if (!exists) throw new NotFoundError('File');

      const disposition = req.query['disposition'] === 'attachment' ? 'attachment' : 'inline';
      const safeName = name.replace(/["\r\n]/g, '');

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);

      gcsFile
        .createReadStream()
        .on('error', (err) => next(err))
        .pipe(res);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid, role } = (req as AuthenticatedRequest).user;
      await FileService.delete(req.params['id']!, uid, role);
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
};
