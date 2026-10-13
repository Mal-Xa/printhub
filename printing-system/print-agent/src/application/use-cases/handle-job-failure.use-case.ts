import * as fs from "node:fs/promises";
import { JobStatus, RETRY_POLICY } from "print-common";
import { LocalJobRecord } from "../../domain/entities/local-job-record.entity";
import { JobQueueRepository } from "../../domain/repositories/job-queue.repository";
import { LoggerPort } from "../../domain/ports/logger.port";
import { ReportJobStatusUseCase } from "./report-job-status.use-case";
import { computeBackoffMs } from "../../shared/backoff";

export type FailedStage = "download" | "print";

/**
 * Applies print-common's shared RETRY_POLICY constants to a failed
 * local job: retries (from the stage that failed) with exponential
 * backoff up to RETRY_POLICY.MAX_RETRIES times, then gives up and
 * reports the job as permanently FAILED.
 */
export class HandleJobFailureUseCase {
  constructor(
    private readonly jobQueueRepo: JobQueueRepository,
    private readonly reportJobStatus: ReportJobStatusUseCase,
    private readonly logger: LoggerPort
  ) {}

  async execute(job: LocalJobRecord, error: unknown, stage: FailedStage): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    job.lastError = message;
    job.attempt += 1;
    job.updatedAt = new Date().toISOString();

    if (job.attempt >= job.maxAttempts) {
      job.phase = "FAILED";
      await this.jobQueueRepo.update(job);
      this.reportJobStatus.execute(job.jobId, JobStatus.FAILED, `Gave up after ${job.attempt} attempts: ${message}`);
      this.logger.error("Job permanently failed", { jobId: job.jobId, stage, attempt: job.attempt, message });
      if (job.localFilePath) {
        await fs.rm(job.localFilePath, { force: true });
      }
      await this.jobQueueRepo.remove(job.jobId);
      return;
    }

    const delayMs = computeBackoffMs(job.attempt, RETRY_POLICY.BACKOFF_BASE_MS, RETRY_POLICY.BACKOFF_MULTIPLIER);
    job.phase = stage === "download" ? "PENDING_DOWNLOAD" : "READY_TO_PRINT";
    job.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
    await this.jobQueueRepo.update(job);

    this.reportJobStatus.execute(
      job.jobId,
      JobStatus.RETRYING,
      `Attempt ${job.attempt} failed at ${stage} stage: ${message}. Retrying in ${Math.round(delayMs / 1000)}s`
    );
    this.logger.warn("Job failed, scheduled for retry", {
      jobId: job.jobId,
      stage,
      attempt: job.attempt,
      delayMs,
    });
  }
}
