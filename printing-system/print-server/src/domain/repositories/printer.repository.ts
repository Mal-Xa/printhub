import type { PaginatedResult, Printer, PrinterId, PrinterStatus } from "print-common";

export interface PrinterListOptions {
  page: number;
  pageSize: number;
  status?: PrinterStatus[];
  agentId?: string;
}

/** Persistence contract for `Printer` records. */
export interface PrinterRepository {
  create(printer: Printer): Promise<Printer>;
  findById(id: PrinterId): Promise<Printer | null>;
  update(printer: Printer): Promise<Printer>;
  list(options: PrinterListOptions): Promise<PaginatedResult<Printer>>;
  findByAgent(agentId: string): Promise<Printer[]>;
}
