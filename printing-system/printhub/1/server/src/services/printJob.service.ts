import { PrintJobRepository } from '../repositories/printJob.repository';
import { OrderRepository } from '../repositories/order.repository';
import { ActivityLogService } from './activityLog.service';
import { PrintJob, PrintJobStatus } from '../types';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { generateId, nowISO } from '../utils/id';
import { getStorage } from '../config/firebase';
import { buildDownloadUrl } from '../utils/storageUrl';
import { env } from '../config/env';
import { UpdatePrintJobStatusInput } from '../validators/printJob.validator';

/** Valid manual status transitions — the queue worker also drives these automatically via polling. */
const JOB_STATUS_TRANSITIONS: Record<PrintJobStatus, PrintJobStatus[]> = {
  waiting: ['printing', 'failed'],
  printing: ['printed', 'failed'],
  printed: [],
  failed: ['waiting'], // allow manual retry
};

export const PrintJobService = {
  /**
   * Creates a print job for one file on one order — the "Send" action on
   * the per-order print review page. Resolves the file's own print
   * settings (falling back to the order-level snapshot if the file hasn't
   * been edited yet), and also persists the chosen printerId back onto the
   * file record so it stays in sync with whatever the admin last sent to.
   * The job itself starts `waiting`; RealPrinterAdapter picks it up and
   * submits it to print-server asynchronously.
   */
  async create(
    orderId: string,
    input: { fileId: string; printerId?: string },
    adminId: string,
  ): Promise<PrintJob> {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order');

    const file = order.files.find((f) => f.id === input.fileId);
    if (!file) throw new NotFoundError('File on this order');

    const resolvedOptions = file.printOptions ?? order.printOptions;

    // Keep a manually chosen printer in sync. With no selection, print-server
    // chooses an online printer just as it does for print-client.
    const files = order.files.map((f) =>
      f.id === file.id
        ? { ...f, ...(input.printerId ? { printerId: input.printerId } : {}), printOptions: resolvedOptions }
        : f,
    );
    await OrderRepository.update(orderId, { files });

    const bucketName = getStorage().bucket().name;
    const job: PrintJob = {
      id: generateId(),
      orderId,
      fileId: file.id,
      fileName: file.name,
      ...(input.printerId ? { printerId: input.printerId } : {}),
      status: 'waiting',
      queuedAt: nowISO(),
      printOptions: resolvedOptions,
      documentRef: {
        sourceUrl: buildDownloadUrl(bucketName, file.storagePath, file.downloadToken),
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      },
    };

    await PrintJobRepository.create(job);

    await ActivityLogService.log({
      action: 'print_job_created',
      userId: adminId,
      targetId: job.id,
      targetType: 'printJob',
      metadata: { orderId, fileId: file.id, ...(input.printerId ? { printerId: input.printerId } : {}), fileName: file.name },
    });

    return job;
  },

  /** Sends every file on the order — "Send all" action. Each file gets its own independent job. */
  async createForOrder(orderId: string, adminId: string): Promise<PrintJob[]> {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order');
    if (order.files.length === 0) throw new BadRequestError('Order has no files to print');

    const jobs: PrintJob[] = [];
    for (const file of order.files) {
      jobs.push(await this.create(orderId, { fileId: file.id, printerId: file.printerId }, adminId));
    }
    return jobs;
  },

  /** Returns all print jobs — used for the admin-wide queue monitoring page */
  async getAll(limit?: number): Promise<PrintJob[]> {
    return PrintJobRepository.findAll(limit);
  },

  /** Returns only waiting jobs, oldest first */
  async getQueue(): Promise<PrintJob[]> {
    return PrintJobRepository.findByStatus('waiting');
  },

  /** Jobs for one order — polled by the print review page for live per-file status */
  async getForOrder(orderId: string): Promise<PrintJob[]> {
    return PrintJobRepository.findByOrder(orderId);
  },

  async getById(id: string): Promise<PrintJob> {
    const job = await PrintJobRepository.findById(id);
    if (!job) throw new NotFoundError('Print job');
    return job;
  },

  async updateStatus(
    id: string,
    input: UpdatePrintJobStatusInput,
    adminId: string,
  ): Promise<PrintJob> {
    const job = await PrintJobRepository.findById(id);
    if (!job) throw new NotFoundError('Print job');

    const allowed = JOB_STATUS_TRANSITIONS[job.status];
    if (!allowed.includes(input.status)) {
      throw new BadRequestError(
        `Cannot transition print job from "${job.status}" to "${input.status}". ` +
          `Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    await PrintJobRepository.updateFields(id, { status: input.status, updatedAt: nowISO() });

    await ActivityLogService.log({
      action: 'print_job_updated',
      userId: adminId,
      targetId: id,
      targetType: 'printJob',
      metadata: { from: job.status, to: input.status },
    });

    return { ...job, status: input.status };
  },

  /**
   * Cancel / hard-delete a print job. Best-effort cancels the remote job on
   * print-server too (if one was ever created) so it doesn't keep printing
   * after Sora considers it cancelled — failures there are logged but don't
   * block the local cancel, since Sora's own record is the source of truth
   * for what the admin sees.
   */
  async cancel(id: string, adminId: string): Promise<void> {
    const job = await PrintJobRepository.findById(id);
    if (!job) throw new NotFoundError('Print job');

    if (job.remoteJobId && job.status !== 'printed' && job.status !== 'failed') {
      try {
        await fetch(
          `${env.printServer.baseUrl.replace(/\/$/, '')}/api/jobs/${encodeURIComponent(job.remoteJobId)}/cancel`,
          { method: 'POST' },
        );
      } catch (err) {
        console.error(`[PrintJobService] Failed to cancel remote job ${job.remoteJobId}:`, err);
      }
    }

    await PrintJobRepository.delete(id);

    await ActivityLogService.log({
      action: 'print_job_updated',
      userId: adminId,
      targetId: id,
      targetType: 'printJob',
      metadata: { action: 'cancelled', fileName: job.fileName },
    });
  },
};
