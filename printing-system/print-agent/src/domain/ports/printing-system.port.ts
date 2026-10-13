import { ConnectionProtocol, PrinterCapabilities, PrintOptions, PrinterStatus } from "print-common";

export interface DetectedPrinter {
  localName: string;
  protocol: ConnectionProtocol;
  status: PrinterStatus;
  capabilities: PrinterCapabilities;
}

export interface SubmitPrintJobInput {
  localPrinterName: string;
  filePath: string;
  options: PrintOptions;
}

export interface SubmitPrintJobResult {
  /** Job id assigned by the local printing system (e.g. a CUPS job id like "MyPrinter-42"). */
  systemJobId: string;
}

export type SystemJobState = "pending" | "processing" | "completed" | "failed" | "unknown";

/**
 * Port over the local operating system's printing subsystem. The only
 * implementation shipped here targets CUPS (the printing system present
 * on both Ubuntu and Raspberry Pi OS), but nothing above this boundary
 * knows that.
 */
export interface PrintingSystemPort {
  detectPrinters(): Promise<DetectedPrinter[]>;
  getPrinterStatus(localPrinterName: string): Promise<PrinterStatus>;
  submitPrintJob(input: SubmitPrintJobInput): Promise<SubmitPrintJobResult>;
  getJobState(systemJobId: string): Promise<SystemJobState>;
  cancelJob(systemJobId: string): Promise<void>;
}
