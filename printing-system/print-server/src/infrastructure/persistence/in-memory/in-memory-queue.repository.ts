import type { QueueItem } from "print-common";
import type { QueueRepository } from "../../../domain/repositories";

/**
 * In-memory `QueueRepository`. Keeps one ordered array per printer,
 * sorted by priority (desc) then enqueue time (asc), and keeps each
 * item's `position` field in sync with its index in that array.
 */
export class InMemoryQueueRepository implements QueueRepository {
  private readonly queues = new Map<string, QueueItem[]>();

  async enqueue(item: QueueItem): Promise<QueueItem[]> {
    const queue = this.queues.get(item.printerId) ?? [];
    const withoutExisting = queue.filter((existing) => existing.jobId !== item.jobId);
    withoutExisting.push(item);
    const resequenced = this.sortAndResequence(withoutExisting);
    this.queues.set(item.printerId, resequenced);
    return resequenced;
  }

  async remove(printerId: string, jobId: string): Promise<QueueItem[]> {
    const queue = this.queues.get(printerId) ?? [];
    const filtered = queue.filter((item) => item.jobId !== jobId);
    const resequenced = this.sortAndResequence(filtered);
    this.queues.set(printerId, resequenced);
    return resequenced;
  }

  async listByPrinter(printerId: string): Promise<QueueItem[]> {
    return this.queues.get(printerId) ?? [];
  }

  async peekNext(printerId: string): Promise<QueueItem | null> {
    const queue = this.queues.get(printerId) ?? [];
    return queue[0] ?? null;
  }

  private sortAndResequence(items: QueueItem[]): QueueItem[] {
    const sorted = [...items].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.enqueuedAt.localeCompare(b.enqueuedAt);
    });
    return sorted.map((item, index) => ({ ...item, position: index + 1 }));
  }
}
