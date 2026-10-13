import { Request, Response, NextFunction } from 'express';
import { PrintJobService } from '../services/printJob.service';
import { AuthenticatedRequest } from '../types';
import { ok, created, noContent } from '../utils/response';
import { CreatePrintJobInput, UpdatePrintJobStatusInput } from '../validators/printJob.validator';
import { processPrintQueueOnce } from '../jobs/printQueue.job';

export const PrintJobController = {
  /** POST /api/orders/:id/print-jobs — "Send" one file from the print review page */
  async createForOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const job = await PrintJobService.create(
        req.params['id']!,
        req.body as CreatePrintJobInput,
        uid,
      );
      await processPrintQueueOnce();
      created(res, await PrintJobService.getById(job.id), 'Print job submitted');
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/orders/:id/print-jobs/send-all — "Send all" action */
  async sendAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const jobs = await PrintJobService.createForOrder(req.params['id']!, uid);
      await processPrintQueueOnce();
      const submittedJobs = await Promise.all(jobs.map((job) => PrintJobService.getById(job.id)));
      created(res, submittedJobs, `${submittedJobs.length} print job(s) submitted`);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/orders/:id/print-jobs — live per-file status polling on the print review page */
  async getForOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobs = await PrintJobService.getForOrder(req.params['id']!);
      ok(res, jobs);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/print-jobs — admin-wide queue monitoring page */
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 100;
      const jobs = await PrintJobService.getAll(limit);
      ok(res, jobs);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/print-jobs/queue — waiting jobs only */
  async getQueue(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queue = await PrintJobService.getQueue();
      ok(res, queue);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await PrintJobService.getById(req.params['id']!);
      ok(res, job);
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/print-jobs/:id/status — manual override; the queue worker normally drives this */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const updated = await PrintJobService.updateStatus(
        req.params['id']!,
        req.body as UpdatePrintJobStatusInput,
        uid,
      );
      ok(res, updated, `Print job status updated to ${updated.status}`);
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /api/print-jobs/:id — cancel (best-effort cancels the remote job too) */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      await PrintJobService.cancel(req.params['id']!, uid);
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
};
