import * as fs from "node:fs/promises";
import { JobStatus } from "print-common";
import { LocalJobRecord } from "../../domain/entities/local-job-record.entity";
import { PrintingSystemPort } from "../../domain/ports/printing-system.port";
import { JobQueueRepository } from "../../domain/repositories/job-queue.repository";
import { LoggerPort } from "../../domain/ports/logger.port";
import { HandleJobFailureUseCase } from "./handle-job-failure.use-case";
import { ReportJobStatusUseCase } from "./report-job-status.use-case";

export class PollPrintProgressUseCase {
  constructor(
    private readonly printingSystem: PrintingSystemPort,
    private readonly jobQueueRepo: JobQueueRepository,
    private readonly handleJobFailure: HandleJobFailureUseCase,
    private readonly reportJobStatus: ReportJobStatusUseCase,
    private readonly logger: LoggerPort
  ) {}

  async execute(job: LocalJobRecord): Promise<void> {
    if (!job.systemJobId) return;

    const state = await this.printingSystem.getJobState(job.systemJobId);

    if (state === "completed") {
      job.phase = "DONE";
      job.updatedAt = new Date().toISOString();
      await this.jobQueueRepo.update(job);
      this.reportJobStatus.execute(job.jobId, JobStatus.COMPLETED, "Print completed");
      this.logger.info("Job completed", { jobId: job.jobId });
      if (job.localFilePath) {
        await fs.rm(job.localFilePath, { force: true });
      }
      await this.jobQueueRepo.remove(job.jobId);
      return;
    }

    if (state === "failed") {
      await this.handleJobFailure.execute(job, new Error("Local printing system reported job failure"), "print");
      return;
    }

    // "pending" / "processing" / "unknown": still in flight, nothing to do this tick.
  }
}
