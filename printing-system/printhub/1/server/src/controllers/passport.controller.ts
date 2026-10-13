import { Request, Response, NextFunction } from 'express';
import { PassportService } from '../services/passport.service';
import { AuthenticatedRequest } from '../types';
import { ok, created, noContent } from '../utils/response';
import { CreatePassportInput } from '../validators/passport.validator';

export const PassportController = {
  /**
   * POST /api/passport
   * Accepts JSON: { template, photosPerSheet, photoUrl? }
   * photoUrl may be a base64 data URL or an https URL.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const input = req.body as CreatePassportInput;
      const sheet = await PassportService.create(input, uid);
      created(res, sheet, 'Passport photo sheet saved');
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid, role } = (req as AuthenticatedRequest).user;
      const sheets =
        role === 'admin'
          ? await PassportService.listAll()
          : await PassportService.listForUser(uid);
      ok(res, sheets);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid, role } = (req as AuthenticatedRequest).user;
      await PassportService.delete(req.params['id']!, uid, role);
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
};
