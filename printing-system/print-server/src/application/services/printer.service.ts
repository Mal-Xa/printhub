import { createHash } from "node:crypto";
import {
  ConnectionProtocol,
  PrinterStatus,
  asPrinterId,
  type AgentId,
  type AgentRegistrationRequest,
  type ListPrintersRequest,
  type PaginatedResult,
  type Printer,
  type PrinterConsumables,
  type PrinterId,
} from "print-common";
import { NotFoundError } from "../../domain/errors";
import type { PrinterRepository } from "../../domain/repositories";
import type { RealtimeGateway } from "../../domain/gateways";
import type { Logger } from "../../infrastructure/logging/logger";

/**
 * CRUD and status-management use cases for `Printer` records. Does
 * not decide *when* to dispatch jobs -- that orchestration lives in
 * `QueueService` and is triggered explicitly by the WebSocket/HTTP
 * layer whenever a printer's availability might have changed.
 */
export class PrinterService {
  constructor(
    private readonly printerRepository: PrinterRepository,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly logger: Logger
  ) {}

  /**
   * Derives a stable, UUID-shaped id from `agentId` + printer name so the
   * same physical printer gets the same `PrinterId` across re-registrations
   * (agent reconnects, server restarts) instead of a fresh `randomUUID()`
   * every time. This is a manual UUIDv5-style hash (no external `uuid`
   * dependency): SHA-1 over the input, with the version/variant nibbles
   * set per RFC 4122 so the result is still a well-formed UUID string.
   */
  private derivePrinterId(agentId: AgentId, name: string): PrinterId {
    const hash = createHash("sha1").update(`${agentId}:${name}`).digest("hex");
    const bytes = hash.slice(0, 32).split("");
    // Version nibble (5 = name-based/SHA-1)
    bytes[12] = "5";
    // Variant nibble (RFC 4122: top two bits are `10`)
    const variantSourceNibble = parseInt(bytes[16] ?? "8", 16);
    bytes[16] = ((variantSourceNibble & 0x3) | 0x8).toString(16);
    const hex = bytes.join("");
    const uuid = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-");
    return asPrinterId(uuid);
  }

  /**
   * Creates or updates a `Printer` record for each printer submitted in an
   * agent registration request. Re-registering the same printer (same
   * agent + name) reuses its existing record and id rather than creating a
   * duplicate, so restarts and reconnects don't churn printer identity or
   * pile up stale entries.
   */
  async registerPrintersForAgent(
    agentId: AgentId,
    printers: AgentRegistrationRequest["printers"]
  ): Promise<PrinterId[]> {
    const printerIds: PrinterId[] = [];
    const now = new Date().toISOString();

    for (const submitted of printers) {
      const id = this.derivePrinterId(agentId, submitted.name);
      const existing = await this.printerRepository.findById(id);

      const printer: Printer = {
        id,
        name: submitted.name,
        agentId,
        protocol: this.parseProtocol(submitted.protocol),
        status: PrinterStatus.ONLINE,
        capabilities: submitted.capabilities,
        lastSeenAt: now,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const saved = existing
        ? await this.printerRepository.update(printer)
        : await this.printerRepository.create(printer);
      printerIds.push(saved.id);
    }

    return printerIds;
  }

  async getPrinter(printerId: PrinterId): Promise<Printer> {
    const printer = await this.printerRepository.findById(printerId);
    if (!printer) throw new NotFoundError("Printer", printerId);
    return printer;
  }

  async listPrinters(request: ListPrintersRequest): Promise<PaginatedResult<Printer>> {
    return this.printerRepository.list({
      page: request.page,
      pageSize: request.pageSize,
      status: request.status as PrinterStatus[] | undefined,
      agentId: request.agentId,
    });
  }

  async updateStatus(
    printerId: PrinterId,
    status: PrinterStatus,
    consumables?: PrinterConsumables
  ): Promise<Printer> {
    const printer = await this.getPrinter(printerId);
    const now = new Date().toISOString();
    const updated: Printer = {
      ...printer,
      status,
      consumables: consumables ?? printer.consumables,
      lastSeenAt: now,
      updatedAt: now,
    };
    const saved = await this.printerRepository.update(updated);

    this.realtimeGateway.broadcastToClients({
      type: "printer:status_changed",
      timestamp: now,
      payload: { printerId, status },
    });

    return saved;
  }

  /** Marks every printer owned by an agent as OFFLINE, e.g. when that agent disconnects. */
  async markPrintersOfflineForAgent(agentId: string): Promise<Printer[]> {
    const printers = await this.printerRepository.findByAgent(agentId);
    const updated: Printer[] = [];
    for (const printer of printers) {
      if (printer.status === PrinterStatus.OFFLINE) continue;
      updated.push(await this.updateStatus(printer.id, PrinterStatus.OFFLINE));
    }
    this.logger.info({ agentId, count: updated.length }, "Marked agent's printers offline");
    return updated;
  }

  private parseProtocol(protocol: string): ConnectionProtocol {
    if ((Object.values(ConnectionProtocol) as string[]).includes(protocol)) {
      return protocol as ConnectionProtocol;
    }
    return ConnectionProtocol.IPP;
  }
}
