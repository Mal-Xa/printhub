import { JobId, JobStatus, RETRY_POLICY } from "print-common";
import { BackendApiPort } from "../../domain/ports/backend-api.port";
import { AgentIdentityRepository } from "../../domain/repositories/agent-identity.repository";
import { JobQueueRepository } from "../../domain/repositories/job-queue.repository";
import { LoggerPort } from "../../domain/ports/logger.port";
import { ReportJobStatusUseCase } from "./report-job-status.use-case";
import { resolveLocalPrinterName } from "../../shared/printer-lookup";

/**
 * Fetches a job's full record from print-server (a WS dispatch only
 * carries the job id + printer id, per print-common's DispatchJobEvent
 * shape) and adds it to the local durable queue if it isn't already
 * there. Shared by the WS dispatch handler and by heartbeat
 * reconciliation (HeartbeatResponse.pendingJobIds), so a job dispatched
 * while the agent was briefly disconnected still gets picked up.
 */
export class EnqueueDispatchedJobUseCase {
  constructor(
    private readonly backendApi: BackendApiPort,
    private readonly agentIdentityRepo: AgentIdentityRepository,
    private readonly jobQueueRepo: JobQueueRepository,
    private readonly reportJobStatus: ReportJobStatusUseCase,
    private readonly logger: LoggerPort
  ) {}

  async execute(jobId: JobId): Promise<void> {
    const existing = await this.jobQueueRepo.get(jobId);
    if (existing) {
      this.logger.debug("Job already present in local queue, skipping", { jobId });
      return;
    }

    const identity = await this.agentIdentityRepo.load();
    if (!identity) {
      this.logger.warn("Cannot enqueue job: agent is not yet registered", { jobId });
      return;
    }

    const { data: job } = await this.backendApi.getJob(jobId);

    if (!job.printerId) {
      this.logger.warn("Dispatched job has no printerId, cannot route it locally", { jobId });
      this.reportJobStatus.execute(jobId, JobStatus.FAILED, "Job has no assigned printer");
      return;
    }

    const localPrinterName = resolveLocalPrinterName(identity, job.printerId);
    if (!localPrinterName) {
      this.logger.warn("Dispatched job's printer is not managed by this agent", {
        jobId,
        printerId: job.printerId,
      });
      this.reportJobStatus.execute(jobId, JobStatus.FAILED, "Printer is not managed by this agent");
      return;
    }

    const now = new Date().toISOString();
    await this.jobQueueRepo.add({
      jobId: job.id,
      printerId: job.printerId,
      document: job.document,
      options: job.options,
      priority: job.priority,
      serverStatus: job.status,
      phase: "PENDING_DOWNLOAD",
      attempt: 0,
      maxAttempts: RETRY_POLICY.MAX_RETRIES + 1,
      enqueuedAt: now,
      updatedAt: now,
    });

    this.logger.info("Job enqueued locally", { jobId: job.id, printer: localPrinterName });
    this.reportJobStatus.execute(jobId, JobStatus.QUEUED, "Job received by agent");
  }
}
