import { PrinterStatusChangedEvent } from "print-common";
import { PrintingSystemPort } from "../../domain/ports/printing-system.port";
import { PrinterRepository } from "../../domain/repositories/printer.repository";
import { AgentIdentityRepository } from "../../domain/repositories/agent-identity.repository";
import { WebSocketTransportPort } from "../../domain/ports/websocket-transport.port";
import { LoggerPort } from "../../domain/ports/logger.port";
import { RegisterAgentUseCase } from "./register-agent.use-case";

/**
 * Re-detects local printers on a timer. Two cases:
 *
 *  - A previously-known printer's status changed (e.g. went offline,
 *    ran out of paper): reported via `PrinterStatusChangedEvent`,
 *    reused bidirectionally the same way ReportJobStatusUseCase reuses
 *    JobStatusChangedEvent -- see docs/PRINT_COMMON_GAPS.md.
 *
 *  - A brand-new printer appears (hot-plugged, or installed after the
 *    agent's initial registration): print-common has no
 *    "register one more printer" contract for a running agent
 *    (`AgentRegistrationRequest` is a full-batch, registration-time
 *    shape; `PrinterDiscoveredEvent`'s payload assumes a PrinterId
 *    already exists, which a brand-new printer doesn't have yet). We
 *    handle this pragmatically by re-running full agent registration
 *    with the current printer set, which the existing contract does
 *    support. See docs/PRINT_COMMON_GAPS.md for a proposed cleaner
 *    contract.
 */
export class SyncPrintersUseCase {
  constructor(
    private readonly printingSystem: PrintingSystemPort,
    private readonly printerRepo: PrinterRepository,
    private readonly agentIdentityRepo: AgentIdentityRepository,
    private readonly wsTransport: WebSocketTransportPort,
    private readonly registerAgentUseCase: RegisterAgentUseCase,
    private readonly logger: LoggerPort
  ) {}

  async execute(): Promise<void> {
    const identity = await this.agentIdentityRepo.load();
    if (!identity) {
      this.logger.debug("Skipping printer sync: agent not yet registered");
      return;
    }

    const detected = await this.printingSystem.detectPrinters();
    const hasNewPrinter = detected.some((printer) => !(printer.localName in identity.printerIdByLocalName));

    if (hasNewPrinter) {
      this.logger.info("New local printer detected; re-registering agent with updated printer set");
      await this.registerAgentUseCase.execute();
      return;
    }

    const now = new Date().toISOString();
    for (const printer of detected) {
      const cached = await this.printerRepo.get(printer.localName);
      const statusChanged = !cached || cached.status !== printer.status;
      const printerId = identity.printerIdByLocalName[printer.localName];

      await this.printerRepo.upsert({
        localName: printer.localName,
        printerId,
        protocol: printer.protocol,
        status: printer.status,
        capabilities: printer.capabilities,
        lastSeenAt: now,
      });

      if (statusChanged && printerId) {
        const event: PrinterStatusChangedEvent = {
          type: "printer:status_changed",
          timestamp: now,
          payload: { printerId, status: printer.status },
        };
        this.wsTransport.send(event);
        this.logger.info("Printer status changed", { printer: printer.localName, status: printer.status });
      }
    }
  }
}
