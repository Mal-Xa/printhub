import { PrinterStatus, ConnectionProtocol } from "../enums";
import { PrinterId, AgentId, Timestamped } from "../utils";

/**
 * Static hardware/driver capabilities of a printer, discovered once
 * by print-agent and reported to print-server.
 */
export interface PrinterCapabilities {
  supportsColor: boolean;
  supportsDuplex: boolean;
  maxDpi: number;
  supportedPaperSizes: string[];
  maxCopiesPerJob: number;
  /** Max file size, in bytes, this printer/driver combination can accept. */
  maxDocumentSizeBytes: number;
}

/** Consumable levels reported periodically by print-agent. */
export interface PrinterConsumables {
  /** 0-100. Undefined if the printer/driver does not report ink/toner level. */
  tonerOrInkPercent?: number;
  paperTrayEmpty: boolean;
}

/**
 * Canonical, full representation of a printer. This is the record of
 * truth held by print-server.
 */
export interface Printer extends Timestamped {
  id: PrinterId;
  name: string;
  agentId: AgentId;
  location?: string;
  protocol: ConnectionProtocol;
  status: PrinterStatus;
  capabilities: PrinterCapabilities;
  consumables?: PrinterConsumables;
  /** ISO 8601 timestamp of the last successful heartbeat/status report. */
  lastSeenAt: string;
}

/**
 * Lightweight projection of a Printer used in list views, WebSocket
 * broadcasts, and anywhere the full record is unnecessary overhead.
 */
export interface PrinterInfo {
  id: PrinterId;
  name: string;
  status: PrinterStatus;
  location?: string;
  capabilities: Pick<PrinterCapabilities, "supportsColor" | "supportsDuplex" | "maxCopiesPerJob">;
}
