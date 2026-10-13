import type { JobId, PaginatedResult, PrintJob } from "print-common";
import { TERMINAL_JOB_STATUSES } from "print-common";
import type { JobListOptions, JobRepository } from "../../../domain/repositories";

/**
 * In-memory `JobRepository`. Suitable for local development, tests,
 * and single-instance deployments. Swap for a database-backed
 * implementation (e.g. Postgres/Prisma) by implementing the same
 * `JobRepository` interface -- no application-layer code changes
 * would be required.
 */
export class InMemoryJobRepository implements JobRepository {
  private readonly jobs = new Map<string, PrintJob>();

  async create(job: PrintJob): Promise<PrintJob> {
    this.jobs.set(job.id, job);
    return job;
  }

  async findById(id: JobId): Promise<PrintJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async update(job: PrintJob): Promise<PrintJob> {
    this.jobs.set(job.id, job);
    return job;
  }

  async list(options: JobListOptions): Promise<PaginatedResult<PrintJob>> {
    let items = Array.from(this.jobs.values());

    if (options.ownerId) {
      items = items.filter((job) => job.ownerId === options.ownerId);
    }
    if (options.printerId) {
      items = items.filter((job) => job.printerId === options.printerId);
    }
    if (options.status && options.status.length > 0) {
      const statusSet = new Set(options.status);
      items = items.filter((job) => statusSet.has(job.status));
    }

    const sortField = options.sort?.field ?? "createdAt";
    const direction = options.sort?.direction ?? "desc";
    items = items.sort((a, b) => {
      const aValue = sortField === "priority" ? a.priority : a[sortField];
      const bValue = sortField === "priority" ? b.priority : b[sortField];
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return direction === "asc" ? comparison : -comparison;
    });

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / options.pageSize));
    const start = (options.page - 1) * options.pageSize;
    const pageItems = items.slice(start, start + options.pageSize);

    return {
      items: pageItems,
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async findActiveByPrinter(printerId: string): Promise<PrintJob[]> {
    return Array.from(this.jobs.values())
      .filter(
        (job) => job.printerId === printerId && !TERMINAL_JOB_STATUSES.includes(job.status)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
