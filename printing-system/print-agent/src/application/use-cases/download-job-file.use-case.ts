import { LocalJobRecord } from "../../domain/entities/local-job-record.entity";
import { FileDownloaderPort } from "../../domain/ports/file-downloader.port";
import { JobQueueRepository } from "../../domain/repositories/job-queue.repository";
import { LoggerPort } from "../../domain/ports/logger.port";
import { HandleJobFailureUseCase } from "./handle-job-failure.use-case";

export class DownloadJobFileUseCase {
  constructor(
    private readonly fileDownloader: FileDownloaderPort,
    private readonly jobQueueRepo: JobQueueRepository,
    private readonly handleJobFailure: HandleJobFailureUseCase,
    private readonly downloadDir: string,
    private readonly logger: LoggerPort
  ) {}

  async execute(job: LocalJobRecord): Promise<void> {
    job.phase = "DOWNLOADING";
    job.updatedAt = new Date().toISOString();
    await this.jobQueueRepo.update(job);

    try {
      const result = await this.fileDownloader.download(job.document, this.downloadDir);
      job.localFilePath = result.filePath;
      job.phase = "READY_TO_PRINT";
      job.updatedAt = new Date().toISOString();
      await this.jobQueueRepo.update(job);
      this.logger.info("Job document downloaded", { jobId: job.jobId, bytes: result.bytesWritten });
    } catch (err) {
      await this.handleJobFailure.execute(job, err, "download");
    }
  }
}
