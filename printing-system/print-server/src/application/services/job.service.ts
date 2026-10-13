import { randomUUID } from "node:crypto";
import {
  ASSIGNABLE_PRINTER_STATUSES,
  JOB_PRIORITY,
  JobStatus,
  RETRY_POLICY,
  TERMINAL_JOB_STATUSES,
  asJobId,
  type CancelJobRequest,
  type CancelJobResponse,
  type JobId,
  type ListJobsRequest,
  type PaginatedResult,
  type PrintJob,
  type PrintRequest,
  type PrinterId,
} from "print-common";
import { JobNotCancellableError, NotFoundError } from "../../domain/errors";
import type { JobRepository, PrinterRepository } from "../../domain/repositories";
import type { RealtimeGateway } from "../../domain/gateways";
import type { Logger } from "../../infrastructure/logging/logger";
import type { QueueService } from "./queue.service";
import type { UploadService } from "./upload.service";

/**
 * Core use cases around a print job's lifecycle: creation from an
 * uploaded document, lookup/listing, cancellation, and reacting to
 * status/progress updates reported by print-agents over WebSocket.
 * Never touches a physical printer -- it only ever updates records
 * and hands work to `QueueService` / `RealtimeGateway`.
 */
export class JobService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly printerRepository: PrinterRepository,
    private readonly uploadService: UploadService,
    private readonly queueService: QueueService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly logger: Logger
  ) {}

  async createJob(request: PrintRequest): Promise<PrintJob> {
    // Uses the *public* DocumentRef (agent-fetchable storageUri), not
    // the repository's internal file:// location -- print-agent runs
    // on a different machine and downloads this over HTTP.
    const document = await this.uploadService.getPublicDocumentRef(request.fileId);
    if (!document) {
      throw new NotFoundError("Uploaded document", request.fileId);
    }

    let printerId: PrinterId | undefined = request.printerId;
    if (printerId) {
      const printer = await this.printerRepository.findById(printerId);
      if (!printer) {
        throw new NotFoundError("Printer", printerId);
      }
    } else {
      printerId = await this.pickAnyAssignablePrinter();
    }

    const now = new Date().toISOString();
    const job: PrintJob = {
      id: asJobId(randomUUID()),
      ownerId: request.ownerId,
      printerId,
      document,
      options: {
        copies: request.options.copies,
        colorMode: request.options.colorMode,
        duplexMode: request.options.duplexMode,
        paperSize: request.options.paperSize,
        paperType: request.options.paperType,
        quality: request.options.quality,
        pageRanges: request.options.pageRanges,
      },
      status: JobStatus.PENDING,
      history: [{ status: JobStatus.PENDING, occurredAt: now }],
      priority: request.priority ?? JOB_PRIORITY.DEFAULT,
      retryCount: 0,
      maxRetries: RETRY_POLICY.MAX_RETRIES,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.jobRepository.create(job);
    this.logger.info({ jobId: created.id, printerId }, "Print job created");

    if (printerId) {
      return this.queueService.enqueueJob(created);
    }

    this.logger.warn({ jobId: created.id }, "No assignable printer available; job left PENDING");
    return created;
  }

  async getJob(jobId: JobId): Promise<PrintJob> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) throw new NotFoundError("Job", jobId);
    return job;
  }

  async listJobs(request: ListJobsRequest): Promise<PaginatedResult<PrintJob>> {
    return this.jobRepository.list({
      page: request.page,
      pageSize: request.pageSize,
      ownerId: request.ownerId,
      printerId: request.printerId,
      status: request.status as PrintJob["status"][] | undefined,
      sort: request.sort,
    });
  }

  async cancelJob(jobId: JobId, request: CancelJobRequest): Promise<CancelJobResponse> {
    const job = await this.getJob(jobId);
    if (TERMINAL_JOB_STATUSES.includes(job.status)) {
      throw new JobNotCancellableError(jobId, job.status);
    }

    if (job.printerId) {
      await this.queueService.removeFromQueue(job.printerId, jobId);
    }
    const dispatchedToAgent = job.status === JobStatus.PRINTING || job.status === JobStatus.ASSIGNED;
    if (dispatchedToAgent && job.agentId) {
      await this.realtimeGateway.cancelJobOnAgent(job.agentId, jobId);
    }

    const now = new Date().toISOString();
    const cancelled: PrintJob = {
      ...job,
      status: JobStatus.CANCELLED,
      updatedAt: now,
      history: [
        ...job.history,
        { status: JobStatus.CANCELLED, occurredAt: now, message: request.reason },
      ],
    };
    await this.jobRepository.update(cancelled);

    this.realtimeGateway.broadcastToClients({
      type: "job:status_changed",
      timestamp: now,
      payload: { jobId, status: JobStatus.CANCELLED, message: request.reason },
    });

    return { jobId, status: JobStatus.CANCELLED };
  }

  /** Applies a status update reported by a print-agent (e.g. PRINTING, COMPLETED, FAILED) to a job's record. */
  async applyStatusUpdate(jobId: JobId, status: JobStatus, message?: string): Promise<void> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      this.logger.warn({ jobId }, "Received status update for unknown job");
      return;
    }
    if (TERMINAL_JOB_STATUSES.includes(job.status)) {
      this.logger.warn({ jobId, status }, "Ignoring status update for already-terminal job");
      return;
    }

    if (status === JobStatus.FAILED && job.retryCount < job.maxRetries && job.printerId) {
      await this.retryJob(job, message);
      return;
    }

    const now = new Date().toISOString();
    const updated: PrintJob = {
      ...job,
      status,
      updatedAt: now,
      history: [...job.history, { status, occurredAt: now, message }],
    };
    await this.jobRepository.update(updated);

    this.realtimeGateway.broadcastToClients({
      type: "job:status_changed",
      timestamp: now,
      payload: { jobId, status, message },
    });
  }

  /** Applies page-level progress reported by a print-agent while a job is PRINTING. */
  async applyProgress(jobId: JobId, pagesPrinted: number, totalPages: number): Promise<void> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      this.logger.warn({ jobId }, "Received progress update for unknown job");
      return;
    }
    this.realtimeGateway.broadcastToClients({
      type: "job:progress",
      timestamp: new Date().toISOString(),
      payload: { jobId, pagesPrinted, totalPages },
    });
  }

  private async retryJob(job: PrintJob, message?: string): Promise<void> {
    const now = new Date().toISOString();
    const retrying: PrintJob = {
      ...job,
      status: JobStatus.RETRYING,
      retryCount: job.retryCount + 1,
      updatedAt: now,
      history: [...job.history, { status: JobStatus.RETRYING, occurredAt: now, message }],
    };
    const saved = await this.jobRepository.update(retrying);
    this.realtimeGateway.broadcastToClients({
      type: "job:status_changed",
      timestamp: now,
      payload: { jobId: job.id, status: JobStatus.RETRYING, message },
    });

    this.logger.info({ jobId: job.id, retryCount: saved.retryCount }, "Retrying failed job");
    await this.queueService.enqueueJob(saved);
  }

  private async pickAnyAssignablePrinter(): Promise<PrinterId | undefined> {
    const { items } = await this.printerRepository.list({ page: 1, pageSize: 200 });
    const assignable = items.find((printer) => ASSIGNABLE_PRINTER_STATUSES.includes(printer.status));
    return assignable?.id;
  }
}
