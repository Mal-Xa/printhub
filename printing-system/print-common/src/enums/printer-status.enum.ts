/**
 * Operational state of a physical or virtual printer, as reported
 * by print-agent to print-server.
 */
export enum PrinterStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  BUSY = "BUSY",
  ERROR = "ERROR",
  WARNING = "WARNING",
  MAINTENANCE = "MAINTENANCE",
  UNKNOWN = "UNKNOWN",
}

/** Printer statuses in which the printer can safely accept new jobs. */
export const ASSIGNABLE_PRINTER_STATUSES: ReadonlyArray<PrinterStatus> = [
  PrinterStatus.ONLINE,
  PrinterStatus.WARNING,
];
