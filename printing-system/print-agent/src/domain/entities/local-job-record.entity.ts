import { DocumentRef, JobId, JobStatus, PrintOptions, PrinterId } from "print-common";

/**
 * The agent's local queue/scheduling state for a job, separate from
 * print-common's `QueueItem` (a lightweight server-side scheduling
 * projection) and `PrintJob` (the server's full canonical record).
 * This record exists only inside print-agent's local durable queue,
 * to survive process restarts between "dispatched" and "completed".
 *
 * It composes print-common's shared types (DocumentRef, PrintOptions,
 * JobStatus, JobId, PrinterId) rather than redefining any of them --
 * the fields below (`phase`, `localFilePath`, `attempt`, ...) are all
 * agent-local execution bookkeeping that has no shared-model
 * equivalent and therefore doesn't belong in print-common.
 */
export type LocalJobPhase =
  | "PENDING_DOWNLOAD"
  | "DOWNLOADING"
  | "READY_TO_PRINT"
  | "SUBMITTING"
  | "PRINTING"
  | "DONE"
  | "FAILED"
  | "CANCELLED";

export interface LocalJobRecord {
  jobId: JobId;
  printerId: PrinterId;
  document: DocumentRef;
  options: PrintOptions;
  priority: number;
  /** Last status the agent reported (or received) for this job from print-common's JobStatus enum. */
  serverStatus: JobStatus;
  phase: LocalJobPhase;
  /** Path to the downloaded document on local disk, once downloaded. */
  localFilePath?: string;
  /** Job id assigned by the local printing system (CUPS), once submitted. */
  systemJobId?: string;
  /** Number of attempts made so far (download + print combined). */
  attempt: number;
  maxAttempts: number;
  lastError?: string;
  /** If set, the queue worker should not act on this job before this ISO 8601 timestamp (retry backoff). */
  nextAttemptAt?: string;
  /** ISO 8601 timestamp of when this job was first enqueued locally. */
  enqueuedAt: string;
  /** ISO 8601 timestamp of the last update to this record. */
  updatedAt: string;
}
