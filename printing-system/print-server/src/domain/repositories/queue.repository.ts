import type { QueueItem } from "print-common";

/**
 * Persistence contract for the lightweight per-printer job queue.
 * `QueueItem` (from print-common) is a scheduling record distinct
 * from the full `PrintJob` -- it only tracks ordering/priority, which
 * is all the queue itself needs to reason about.
 */
export interface QueueRepository {
  /** Adds an item, keeping the printer's queue ordered by priority (desc) then enqueuedAt (asc). */
  enqueue(item: QueueItem): Promise<QueueItem[]>;
  /** Removes a job from whichever printer queue it is in. Returns the updated queue for that printer, if any. */
  remove(printerId: string, jobId: string): Promise<QueueItem[]>;
  /** Full ordered queue for a printer, position fields kept in sync with array order. */
  listByPrinter(printerId: string): Promise<QueueItem[]>;
  /** Removes and returns the highest-priority item for a printer, if the queue is non-empty. */
  peekNext(printerId: string): Promise<QueueItem | null>;
}
