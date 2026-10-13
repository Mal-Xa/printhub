import { ConnectionProtocol, PrinterCapabilities, PrinterId, PrinterStatus } from "print-common";

/**
 * The agent's local view of a printer it manages. Composes
 * print-common's `PrinterCapabilities`/`PrinterStatus`/`PrinterId`
 * directly rather than redefining them -- this type only adds the
 * agent-local bookkeeping (the OS-level printer name, last-seen time)
 * that print-common's `Printer`/`PrinterInfo` don't need to carry.
 */
export interface LocalPrinterRecord {
  /** Name as known to the local printing system (CUPS queue name). */
  localName: string;
  /** Assigned once print-server has registered this printer; absent until then. */
  printerId?: PrinterId;
  protocol: ConnectionProtocol;
  status: PrinterStatus;
  capabilities: PrinterCapabilities;
  /** ISO 8601 timestamp of the last successful local detection. */
  lastSeenAt: string;
}
