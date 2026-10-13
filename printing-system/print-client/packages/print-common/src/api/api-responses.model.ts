import { JobStatus, PrinterStatus } from "../enums";
import { PrintJob, Printer, PrinterInfo, AgentInfo } from "../interfaces";
import { JobId, PrinterId, FileId, PaginationMeta } from "../utils";

/** Generic wrapper for a single-resource response. */
export interface ApiSuccessResponse<T> {
  data: T;
}

/** Generic wrapper for a paginated list response. */
export interface ApiListResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** print-server -> print-client: result of a completed upload. */
export interface UploadResponse {
  fileId: FileId;
  storageUri: string;
  /** ISO 8601 timestamp. */
  uploadedAt: string;
}

/** print-server -> print-client: the newly created job. */
export interface PrintResponse {
  job: PrintJob;
}

/** print-server -> print-client: result of a cancellation request. */
export interface CancelJobResponse {
  jobId: JobId;
  status: JobStatus;
}

/** print-server -> print-client: current status of a single job. */
export interface JobStatusResponse {
  jobId: JobId;
  status: JobStatus;
  /** ISO 8601 timestamp of the most recent status change. */
  updatedAt: string;
  history?: PrintJob["history"];
}

/** print-server -> print-client/print-agent: current status of a single printer. */
export interface PrinterStatusResponse {
  printerId: PrinterId;
  status: PrinterStatus;
  consumables?: Printer["consumables"];
}

/** print-server -> print-agent: result of a successful agent registration. */
export interface AgentRegistrationResponse {
  agentId: AgentInfo["id"];
  /** Interval, in seconds, at which print-agent should send heartbeats. */
  heartbeatIntervalSeconds: number;
  /** Server-assigned ids for the printers submitted in the registration request, in the same order. */
  printerIds: PrinterId[];
}

/** print-server -> print-agent: acknowledgement of a heartbeat, may include pending work. */
export interface HeartbeatResponse {
  /** ISO 8601 timestamp. */
  acknowledgedAt: string;
  pendingJobIds: JobId[];
}

export type GetJobResponse = ApiSuccessResponse<PrintJob>;
export type ListJobsResponse = ApiListResponse<PrintJob>;
export type GetPrinterResponse = ApiSuccessResponse<Printer>;
export type ListPrintersResponse = ApiListResponse<PrinterInfo>;
export type GetAgentResponse = ApiSuccessResponse<AgentInfo>;
export type ListAgentsResponse = ApiListResponse<AgentInfo>;
