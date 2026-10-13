import {
  ASSIGNABLE_PRINTER_STATUSES,
  JobStatus,
  type AgentId,
  type JobId,
  type PrintJob,
  type PrinterId,
  type QueueItem,
} from "print-common";
import { AgentUnreachableError, NotFoundError } from "../../domain/errors";
import type {
  JobRepository,
  PrinterRepository,
  QueueRepository,
} from "../../domain/repositories";
import type { RealtimeGateway } from "../../domain/gateways";
import type { Logger } from "../../infrastructure/logging/logger";

/**
 * Manages the lightweight per-printer print queue: enqueuing newly
 * created jobs, dispatching the next eligible job to a connected
 * agent when a printer is free, and keeping clients informed via
 * `queue:updated` broadcasts.
 */
export class QueueService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly queueRepository: QueueRepository,
    private readonly printerRepository: PrinterRepository,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly logger: Logger
  ) {}

  /** Adds a job to its printer's queue, transitions it to QUEUED, and attempts immediate dispatch. */
  async enqueueJob(job: PrintJob): Promise<PrintJob> {
    if (!job.printerId) {
      throw new NotFoundError("Printer assignment for job", job.id);
    }

    const item: QueueItem = {
      jobId: job.id,
      printerId: job.printerId,
      priority: job.priority,
      position: 0,
      enqueuedAt: new Date().toISOString(),
    };
    const queue = await this.queueRepository.enqueue(item);

    const now = new Date().toISOString();
    const queuedJob: PrintJob = {
      ...job,
      status: JobStatus.QUEUED,
      updatedAt: now,
      history: [...job.history, { status: JobStatus.QUEUED, occurredAt: now }],
    };
    const saved = await this.jobRepository.update(queuedJob);

    this.realtimeGateway.broadcastToClients({
      type: "job:status_changed",
      timestamp: now,
      payload: { jobId: saved.id, status: JobStatus.QUEUED },
    });
    this.broadcastQueueLength(job.printerId, queue.length);

    await this.dispatchNext(job.printerId);
    return saved;
  }

  /** Removes a job from its printer's queue (used on cancellation), if it is still queued there. */
  async removeFromQueue(printerId: PrinterId, jobId: JobId): Promise<void> {
    const queue = await this.queueRepository.remove(printerId, jobId);
    this.broadcastQueueLength(printerId, queue.length);
  }

  async getQueue(printerId: PrinterId): Promise<QueueItem[]> {
    return this.queueRepository.listByPrinter(printerId);
  }

  /**
   * Attempts to hand the highest-priority queued job for a printer to
   * its owning agent, if the printer is assignable and the agent is
   * connected. Safe to call repeatedly / speculatively (e.g. after a
   * heartbeat or printer status change) -- it is a no-op if there is
   * nothing to dispatch.
   */
  async dispatchNext(printerId: PrinterId): Promise<void> {
    const printer = await this.printerRepository.findById(printerId);
    if (!printer || !ASSIGNABLE_PRINTER_STATUSES.includes(printer.status)) {
      return;
    }

    const next = await this.queueRepository.peekNext(printerId);
    if (!next) return;

    const job = await this.jobRepository.findById(next.jobId);
    if (!job) {
      this.logger.warn({ jobId: next.jobId }, "Queued job no longer exists; dropping from queue");
      await this.queueRepository.remove(printerId, next.jobId);
      return;
    }

    const agentId: AgentId = printer.agentId;
    try {
      await this.realtimeGateway.dispatchJobToAgent(agentId, job.id, printerId);
    } catch (error) {
      if (error instanceof AgentUnreachableError) {
        this.logger.warn({ printerId, agentId }, "Agent unreachable; leaving job queued");
        return;
      }
      throw error;
    }

    const queue = await this.queueRepository.remove(printerId, job.id);
    const now = new Date().toISOString();
    const assignedJob: PrintJob = {
      ...job,
      agentId,
      status: JobStatus.ASSIGNED,
      updatedAt: now,
      history: [...job.history, { status: JobStatus.ASSIGNED, occurredAt: now }],
    };
    await this.jobRepository.update(assignedJob);

    this.realtimeGateway.broadcastToClients({
      type: "job:status_changed",
      timestamp: now,
      payload: { jobId: job.id, status: JobStatus.ASSIGNED },
    });
    this.broadcastQueueLength(printerId, queue.length);
  }

  private broadcastQueueLength(printerId: PrinterId, queueLength: number): void {
    this.realtimeGateway.broadcastToClients({
      type: "queue:updated",
      timestamp: new Date().toISOString(),
      payload: { printerId, queueLength },
    });
  }
}
