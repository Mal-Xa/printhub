import { PrinterId } from "print-common";
import { LocalJobRecord } from "../../domain/entities/local-job-record.entity";
import { JobQueueRepository } from "../../domain/repositories/job-queue.repository";
import { LoggerPort } from "../../domain/ports/logger.port";
import { DownloadJobFileUseCase } from "./download-job-file.use-case";
import { PrintJobUseCase } from "./print-job.use-case";
import { PollPrintProgressUseCase } from "./poll-print-progress.use-case";

const IN_FLIGHT_PHASES = new Set(["DOWNLOADING", "SUBMITTING", "PRINTING"]);

/**
 * One tick of the local queue worker. Each local printer only ever has
 * one job actively downloading/printing at a time (matching how a
 * physical printer works); everything else waits its turn, ordered by
 * priority then arrival time.
 */
export class ProcessJobQueueUseCase {
  constructor(
    private readonly jobQueueRepo: JobQueueRepository,
    private readonly downloadJobFile: DownloadJobFileUseCase,
    private readonly printJob: PrintJobUseCase,
    private readonly pollPrintProgress: PollPrintProgressUseCase,
    private readonly logger: LoggerPort
  ) {}

  async execute(): Promise<void> {
    const jobs = await this.jobQueueRepo.list();
    const now = Date.now();

    const busyPrinters = new Set<PrinterId>(
      jobs.filter((job) => IN_FLIGHT_PHASES.has(job.phase)).map((job) => job.printerId)
    );

    // Advance jobs already mid-flight (polling for print completion).
    for (const job of jobs) {
      if (job.phase === "PRINTING") {
        await this.pollPrintProgress.execute(job).catch((err) =>
          this.logger.error("Error polling print progress", { jobId: job.jobId, error: String(err) })
        );
      }
    }

    // Start the next eligible job per idle printer.
    const candidates = jobs
      .filter((job) => job.phase === "PENDING_DOWNLOAD" || job.phase === "READY_TO_PRINT")
      .filter((job) => !job.nextAttemptAt || Date.parse(job.nextAttemptAt) <= now)
      .filter((job) => !busyPrinters.has(job.printerId))
      .sort(byPriorityThenAge);

    for (const job of candidates) {
      if (busyPrinters.has(job.printerId)) continue; // already claimed by an earlier candidate this tick
      busyPrinters.add(job.printerId);
      await this.advance(job);
    }
  }

  private async advance(job: LocalJobRecord): Promise<void> {
    try {
      if (job.phase === "PENDING_DOWNLOAD") {
        await this.downloadJobFile.execute(job);
      } else if (job.phase === "READY_TO_PRINT") {
        await this.printJob.execute(job);
      }
    } catch (err) {
      this.logger.error("Unhandled error advancing job", { jobId: job.jobId, error: String(err) });
    }
  }
}

function byPriorityThenAge(a: LocalJobRecord, b: LocalJobRecord): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return Date.parse(a.enqueuedAt) - Date.parse(b.enqueuedAt);
}
