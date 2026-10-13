import { AgentId, AgentRegistrationRequest, PrinterId } from "print-common";
import { BackendApiPort } from "../../domain/ports/backend-api.port";
import { PrintingSystemPort } from "../../domain/ports/printing-system.port";
import { AgentIdentityRepository } from "../../domain/repositories/agent-identity.repository";
import { PrinterRepository } from "../../domain/repositories/printer.repository";
import { LoggerPort } from "../../domain/ports/logger.port";
import { computeBackoffMs } from "../../shared/backoff";

const REGISTER_RETRY_BASE_MS = 2000;
const REGISTER_RETRY_MULTIPLIER = 2;
const REGISTER_RETRY_MAX_MS = 60_000;

export interface RegisterAgentResult {
  heartbeatIntervalSeconds: number;
  /** Server-assigned agent id, needed by the caller to update the WebSocket transport before connecting. */
  agentId: AgentId;
}

/**
 * Registers this agent (and every printer detected locally) with
 * print-server. Retries indefinitely with capped backoff so the
 * service starts up cleanly even if print-server isn't reachable yet
 * (e.g. agent starting before the network is fully up at boot).
 */
export class RegisterAgentUseCase {
  constructor(
    private readonly printingSystem: PrintingSystemPort,
    private readonly backendApi: BackendApiPort,
    private readonly agentIdentityRepo: AgentIdentityRepository,
    private readonly printerRepo: PrinterRepository,
    private readonly hostname: string,
    private readonly agentVersion: string,
    private readonly logger: LoggerPort
  ) {}

  async execute(): Promise<RegisterAgentResult> {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        return await this.attemptRegistration();
      } catch (err) {
        const delay = computeBackoffMs(attempt, REGISTER_RETRY_BASE_MS, REGISTER_RETRY_MULTIPLIER, REGISTER_RETRY_MAX_MS);
        this.logger.warn("Agent registration failed, will retry", {
          attempt,
          delayMs: delay,
          error: String(err),
        });
        await sleep(delay);
      }
    }
  }

  private async attemptRegistration(): Promise<RegisterAgentResult> {
    const detected = await this.printingSystem.detectPrinters();

    const request: AgentRegistrationRequest = {
      hostname: this.hostname,
      version: this.agentVersion,
      printers: detected.map((printer) => ({
        name: printer.localName,
        protocol: printer.protocol,
        capabilities: printer.capabilities,
      })),
    };

    const response = await this.backendApi.registerAgent(request);

    const printerIdByLocalName: Record<string, PrinterId> = {};
    detected.forEach((printer, index) => {
      const printerId = response.printerIds[index];
      if (printerId) {
        printerIdByLocalName[printer.localName] = printerId;
      }
    });

    await this.agentIdentityRepo.save({
      agentId: response.agentId,
      hostname: this.hostname,
      registeredAt: new Date().toISOString(),
      printerIdByLocalName,
    });

    const now = new Date().toISOString();
    for (const printer of detected) {
      await this.printerRepo.upsert({
        localName: printer.localName,
        printerId: printerIdByLocalName[printer.localName],
        protocol: printer.protocol,
        status: printer.status,
        capabilities: printer.capabilities,
        lastSeenAt: now,
      });
    }

    this.logger.info("Agent registered with print-server", {
      agentId: response.agentId,
      printerCount: detected.length,
    });

    return { heartbeatIntervalSeconds: response.heartbeatIntervalSeconds, agentId: response.agentId };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
