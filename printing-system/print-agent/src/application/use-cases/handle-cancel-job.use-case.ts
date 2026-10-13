import * as fs from "node:fs/promises";
import { CancelJobEvent, JobStatus } from "print-common";
import { JobQueueRepository } from "../../domain/repositories/job-queue.repository";
import { PrintingSystemPort } from "../../domain/ports/printing-system.port";
import { LoggerPort } from "../../domain/ports/logger.port";
import { ReportJobStatusUseCase } from "./report-job-status.use-case";

export class HandleCancelJobUseCase {
  constructor(
    private readonly jobQueueRepo: JobQueueRepository,
    private readonly printingSystem: PrintingSystemPort,
    private readonly reportJobStatus: ReportJobStatusUseCase,
    private readonly logger: LoggerPort
  ) {}

  async execute(event: CancelJobEvent): Promise<void> {
    const { jobId } = event.payload;
    const record = await this.jobQueueRepo.get(jobId);
    if (!record) {
      this.logger.debug("Cancel requested for a job not in local queue (already finished or never dispatched here)", {
        jobId,
      });
      return;
    }

    if (record.phase === "PRINTING" && record.systemJobId) {
      try {
        await this.printingSystem.cancelJob(record.systemJobId);
      } catch (err) {
        this.logger.warn("Failed to cancel job on local printing system", { jobId, error: String(err) });
      }
    }

    if (record.localFilePath) {
      await fs.rm(record.localFilePath, { force: true });
    }

    await this.jobQueueRepo.remove(jobId);
    this.reportJobStatus.execute(jobId, JobStatus.CANCELLED, "Cancelled by user request");
    this.logger.info("Job cancelled", { jobId });
  }
}
