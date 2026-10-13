import type { PaginatedResult, Printer, PrinterId } from "print-common";
import type { PrinterListOptions, PrinterRepository } from "../../../domain/repositories";

/** In-memory `PrinterRepository`. See `InMemoryJobRepository` for swap-out notes. */
export class InMemoryPrinterRepository implements PrinterRepository {
  private readonly printers = new Map<string, Printer>();

  async create(printer: Printer): Promise<Printer> {
    this.printers.set(printer.id, printer);
    return printer;
  }

  async findById(id: PrinterId): Promise<Printer | null> {
    return this.printers.get(id) ?? null;
  }

  async update(printer: Printer): Promise<Printer> {
    this.printers.set(printer.id, printer);
    return printer;
  }

  async list(options: PrinterListOptions): Promise<PaginatedResult<Printer>> {
    let items = Array.from(this.printers.values());

    if (options.status && options.status.length > 0) {
      const statusSet = new Set(options.status);
      items = items.filter((printer) => statusSet.has(printer.status));
    }
    if (options.agentId) {
      items = items.filter((printer) => printer.agentId === options.agentId);
    }

    items = items.sort((a, b) => a.name.localeCompare(b.name));

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / options.pageSize));
    const start = (options.page - 1) * options.pageSize;
    const pageItems = items.slice(start, start + options.pageSize);

    return {
      items: pageItems,
      pagination: { page: options.page, pageSize: options.pageSize, totalItems, totalPages },
    };
  }

  async findByAgent(agentId: string): Promise<Printer[]> {
    return Array.from(this.printers.values()).filter((printer) => printer.agentId === agentId);
  }
}
