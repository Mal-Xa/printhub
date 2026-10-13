/**
 * Lifecycle states of a print job as it moves through
 * print-client -> print-server -> print-agent -> physical printer.
 */
export enum JobStatus {
  PENDING = "PENDING",
  QUEUED = "QUEUED",
  ASSIGNED = "ASSIGNED",
  PRINTING = "PRINTING",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
  RETRYING = "RETRYING",
}

/** Job statuses after which no further automatic transition occurs. */
export const TERMINAL_JOB_STATUSES: ReadonlyArray<JobStatus> = [
  JobStatus.COMPLETED,
  JobStatus.CANCELLED,
  JobStatus.FAILED,
];
