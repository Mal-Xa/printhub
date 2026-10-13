import { ColorMode, DuplexMode, PaperSize, PaperType, PrintQuality } from "../enums";
import { PrinterId, AgentId, UserId, FileId, PaginationParams, SortParam } from "../utils";

/** print-client -> print-server: request to upload a document prior to printing. */
export interface UploadRequest {
  ownerId: UserId;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** print-client -> print-server: request to create a print job for an already-uploaded document. */
export interface PrintRequest {
  ownerId: UserId;
  fileId: FileId;
  printerId?: PrinterId;
  options: {
    copies: number;
    colorMode: ColorMode;
    duplexMode: DuplexMode;
    paperSize: PaperSize;
    paperType: PaperType;
    quality: PrintQuality;
    pageRanges?: string;
  };
  priority?: number;
}

/** print-client -> print-server: request to cancel an existing job. */
export interface CancelJobRequest {
  jobId: string;
  reason?: string;
}

/** Query parameters for listing jobs. */
export interface ListJobsRequest extends PaginationParams {
  ownerId?: string;
  printerId?: string;
  status?: string[];
  sort?: SortParam<"createdAt" | "updatedAt" | "priority">;
}

/** Query parameters for listing printers. */
export interface ListPrintersRequest extends PaginationParams {
  status?: string[];
  agentId?: string;
}

/** print-agent -> print-server: request to register this agent and the printers it manages. */
export interface AgentRegistrationRequest {
  hostname: string;
  version: string;
  printers: Array<{
    name: string;
    protocol: string;
    capabilities: {
      supportsColor: boolean;
      supportsDuplex: boolean;
      maxDpi: number;
      supportedPaperSizes: string[];
      maxCopiesPerJob: number;
      maxDocumentSizeBytes: number;
    };
  }>;
}

/** print-agent -> print-server: periodic liveness/status report. */
export interface HeartbeatRequest {
  agentId: AgentId;
  /** ISO 8601 timestamp. */
  sentAt: string;
  printerStatuses?: Array<{
    printerId: PrinterId;
    status: string;
  }>;
}
