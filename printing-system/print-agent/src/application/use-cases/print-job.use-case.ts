import { JobStatus } from "print-common";
import { LocalJobRecord } from "../../domain/entities/local-job-record.entity";
import { PrintingSystemPort } from "../../domain/ports/printing-system.port";
import { JobQueueRepository } from "../../domain/repositories/job-queue.repository";
import { AgentIdentityRepository } from "../../domain/repositories/agent-identity.repository";
import { LoggerPort } from "../../domain/ports/logger.port";
import { HandleJobFailureUseCase } from "./handle-job-failure.use-case";
import { ReportJobStatusUseCase } from "./report-job-status.use-case";
import { resolveLocalPrinterName } from "../../shared/printer-lookup";

export class PrintJobUseCase {
  constructor(
    private readonly printingSystem: PrintingSystemPort,
    private readonly jobQueueRepo: JobQueueRepository,
    private readonly agentIdentityRepo: AgentIdentityRepository,
    private readonly handleJobFailure: HandleJobFailureUseCase,
    private readonly reportJobStatus: ReportJobStatusUseCase,
    private readonly logger: LoggerPort
  ) {}

  async execute(job: LocalJobRecord): Promise<void> {
    const identity = await this.agentIdentityRepo.load();
    const localPrinterName = identity ? resolveLocalPrinterName(identity, job.printerId) : undefined;

    if (!localPrinterName || !job.localFilePath) {
      await this.handleJobFailure.execute(
        job,
        new Error("Printer is no longer managed by this agent, or the file was not downloaded"),
        "print"
      );
      return;
    }

    job.phase = "SUBMITTING";
    job.updatedAt = new Date().toISOString();
    await this.jobQueueRepo.update(job);

    try {
      const result = await this.printingSystem.submitPrintJob({
        localPrinterName,
        filePath: job.localFilePath,
        options: job.options,
      });
      job.systemJobId = result.systemJobId;
      job.phase = "PRINTING";
      job.updatedAt = new Date().toISOString();
      await this.jobQueueRepo.update(job);
      this.reportJobStatus.execute(job.jobId, JobStatus.PRINTING, "Job submitted to printer");
      this.logger.info("Job submitted to local printing system", { jobId: job.jobId, systemJobId: result.systemJobId });
    } catch (err) {
      await this.handleJobFailure.execute(job, err, "print");
    }
  }
}
