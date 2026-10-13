import { Request, Response, NextFunction } from 'express';
import { PrinterService } from '../services/printer.service';
import { ok } from '../utils/response';

export const PrinterController = {
  /** GET /api/printers — live printer list, proxied + cached from print-server */
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const printers = await PrinterService.list();
      ok(res, printers);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/printers/health — distinguishes "print-server unreachable" from per-printer offline */
  async health(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reachable = await PrinterService.isBridgeReachable();
      ok(res, { printServerReachable: reachable });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/printers/:id — full live printer record (capabilities, consumables, lastSeenAt) */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const printer = await PrinterService.getById(req.params['id']!);
      ok(res, printer);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/printers/:id/queue — proxies print-server's queue for this printer */
  async getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queue = await PrinterService.getQueue(req.params['id']!);
      ok(res, queue);
    } catch (err) {
      next(err);
    }
  },
};
