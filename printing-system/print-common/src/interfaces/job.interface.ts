import { JobStatus, ColorMode, DuplexMode, PaperSize, PaperType, PrintQuality } from "../enums";
import { JobId, PrinterId, AgentId, UserId, FileId, Timestamped } from "../utils";

/** Print options selected by the user for a given job. */
export interface PrintOptions {
  copies: number;
  colorMode: ColorMode;
  duplexMode: DuplexMode;
  paperSize: PaperSize;
  paperType: PaperType;
  quality: PrintQuality;
  /** e.g. "1-5,8,11-13". Undefined means print all pages. */
  pageRanges?: string;
}

/** Reference to the uploaded source document being printed. */
export interface DocumentRef {
  fileId: FileId;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageUri: string;
  pageCount?: number;
}

/** A single event in a job's audit trail. */
export interface JobStatusEvent {
  status: JobStatus;
  /** ISO 8601 timestamp. */
  occurredAt: string;
  message?: string;
}

/**
 * Canonical, full representation of a print job. This is the record
 * of truth held by print-server.
 */
export interface PrintJob extends Timestamped {
  id: JobId;
  ownerId: UserId;
  printerId?: PrinterId;
  agentId?: AgentId;
  document: DocumentRef;
  options: PrintOptions;
  status: JobStatus;
  history: JobStatusEvent[];
  priority: number;
  retryCount: number;
  maxRetries: number;
}

/**
 * Entry in a printer's job queue. Distinct from PrintJob: this is the
 * lightweight scheduling record used by queue-management views, not
 * the full job document.
 */
export interface QueueItem {
  jobId: JobId;
  printerId: PrinterId;
  priority: number;
  /** 1-based position in the printer's queue; 1 = next to print. */
  position: number;
  /** ISO 8601 timestamp of when the job entered this queue. */
  enqueuedAt: string;
}
