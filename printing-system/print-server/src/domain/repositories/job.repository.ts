import type { JobId, JobStatus, PaginatedResult, PrintJob, SortParam } from "print-common";

/** Filter/sort/pagination options for listing jobs. */
export interface JobListOptions {
  page: number;
  pageSize: number;
  ownerId?: string;
  printerId?: string;
  status?: JobStatus[];
  sort?: SortParam<"createdAt" | "updatedAt" | "priority">;
}

/**
 * Persistence contract for `PrintJob` records. Application services
 * depend on this interface only -- never on a concrete storage
 * technology -- so the in-memory implementation can be swapped for a
 * database-backed one without touching business logic.
 */
export interface JobRepository {
  create(job: PrintJob): Promise<PrintJob>;
  findById(id: JobId): Promise<PrintJob | null>;
  update(job: PrintJob): Promise<PrintJob>;
  list(options: JobListOptions): Promise<PaginatedResult<PrintJob>>;
  /** Jobs currently queued or assigned for a given printer, oldest first. */
  findActiveByPrinter(printerId: string): Promise<PrintJob[]>;
}
