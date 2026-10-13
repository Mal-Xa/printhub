import * as fs from "node:fs/promises";
import * as path from "node:path";
import { JobQueueRepository } from "../../domain/repositories/job-queue.repository";
import { LoggerPort } from "../../domain/ports/logger.port";

/**
 * Per-job cleanup already removes a job's downloaded file as soon as it
 * completes, fails permanently, or is cancelled. This is the safety
 * net for anything that slips through that (e.g. a process crash
 * between download and print): any file in the download directory
 * older than `maxAgeMinutes` that isn't referenced by an active local
 * job gets deleted.
 */
export class CleanupTempFilesUseCase {
  constructor(
    private readonly jobQueueRepo: JobQueueRepository,
    private readonly downloadDir: string,
    private readonly maxAgeMinutes: number,
    private readonly logger: LoggerPort
  ) {}

  async execute(): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.downloadDir);
    } catch (err) {
      if (isNotFound(err)) return;
      throw err;
    }

    const activeJobs = await this.jobQueueRepo.list();
    const referencedPaths = new Set(
      activeJobs.map((job) => job.localFilePath).filter((p): p is string => Boolean(p))
    );

    const cutoffMs = Date.now() - this.maxAgeMinutes * 60_000;

    for (const entry of entries) {
      const fullPath = path.join(this.downloadDir, entry);
      if (referencedPaths.has(fullPath)) continue;

      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile() && stat.mtimeMs < cutoffMs) {
          await fs.rm(fullPath, { force: true });
          this.logger.info("Removed orphaned temp file", { file: entry });
        }
      } catch (err) {
        this.logger.debug("Failed to inspect/clean temp file", { file: entry, error: String(err) });
      }
    }
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "ENOENT";
}
