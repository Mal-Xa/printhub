import { randomUUID } from "node:crypto";
import {
  AGENT_HEARTBEAT,
  AgentStatus,
  PrinterStatus,
  asAgentId,
  type AgentId,
  type AgentInfo,
  type AgentRegistrationRequest,
  type AgentRegistrationResponse,
  type HeartbeatRequest,
  type HeartbeatResponse,
  type PaginatedResult,
} from "print-common";
import { NotFoundError } from "../../domain/errors";
import type { AgentRepository } from "../../domain/repositories";
import type { RealtimeGateway } from "../../domain/gateways";
import type { Logger } from "../../infrastructure/logging/logger";
import type { PrinterService } from "./printer.service";

export interface ListAgentsOptions {
  page: number;
  pageSize: number;
}

/**
 * Registration, heartbeat, and connectivity lifecycle for print-agent
 * instances. Delegates printer creation to `PrinterService` so this
 * service stays focused on agent identity and health.
 */
export class AgentService {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly printerService: PrinterService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly logger: Logger
  ) {}

  async register(request: AgentRegistrationRequest): Promise<AgentRegistrationResponse> {
    const now = new Date().toISOString();
    let agent = await this.agentRepository.findByHostname(request.hostname);

    if (!agent) {
      agent = {
        id: asAgentId(randomUUID()),
        hostname: request.hostname,
        version: request.version,
        status: AgentStatus.REGISTERING,
        managedPrinterIds: [],
        registeredAt: now,
        lastHeartbeatAt: now,
      };
      await this.agentRepository.create(agent);
    }

    const printerIds = await this.printerService.registerPrintersForAgent(
      agent.id,
      request.printers
    );

    const registered: AgentInfo = {
      ...agent,
      version: request.version,
      status: AgentStatus.ONLINE,
      managedPrinterIds: printerIds,
      lastHeartbeatAt: now,
    };
    await this.agentRepository.update(registered);

    this.logger.info(
      { agentId: registered.id, hostname: registered.hostname, printers: printerIds.length },
      "Agent registered"
    );

    this.realtimeGateway.broadcastToClients({
      type: "agent:status_changed",
      timestamp: now,
      payload: { agentId: registered.id, status: AgentStatus.ONLINE },
    });

    return {
      agentId: registered.id,
      heartbeatIntervalSeconds: AGENT_HEARTBEAT.INTERVAL_SECONDS,
      printerIds,
    };
  }

  async heartbeat(agentId: AgentId, request: HeartbeatRequest): Promise<HeartbeatResponse> {
    const agent = await this.getAgent(agentId);

    const updated: AgentInfo = {
      ...agent,
      status: AgentStatus.ONLINE,
      lastHeartbeatAt: request.sentAt,
    };
    await this.agentRepository.update(updated);

    if (request.printerStatuses) {
      for (const printerUpdate of request.printerStatuses) {
        await this.printerService.updateStatus(
          printerUpdate.printerId,
          this.coercePrinterStatus(printerUpdate.status)
        );
      }
    }

    return {
      acknowledgedAt: new Date().toISOString(),
      pendingJobIds: [],
    };
  }

  async getAgent(agentId: AgentId): Promise<AgentInfo> {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) throw new NotFoundError("Agent", agentId);
    return agent;
  }

  async listAgents(options: ListAgentsOptions): Promise<PaginatedResult<AgentInfo>> {
    return this.agentRepository.list(options);
  }

  /** Called by the WebSocket layer when an agent's socket closes. */
  async handleDisconnect(agentId: AgentId): Promise<void> {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) return;

    const now = new Date().toISOString();
    await this.agentRepository.update({
      ...agent,
      status: AgentStatus.DISCONNECTED,
      lastHeartbeatAt: agent.lastHeartbeatAt,
    });

    this.realtimeGateway.broadcastToClients({
      type: "agent:status_changed",
      timestamp: now,
      payload: { agentId, status: AgentStatus.DISCONNECTED },
    });

    await this.printerService.markPrintersOfflineForAgent(agentId);
    this.logger.info({ agentId }, "Agent marked disconnected");
  }

  /** Sweeps agents whose last heartbeat is older than the configured timeout and marks them offline. */
  async sweepStaleAgents(): Promise<void> {
    const { items } = await this.agentRepository.list({ page: 1, pageSize: 1000 });
    const timeoutMs = AGENT_HEARTBEAT.TIMEOUT_SECONDS * 1000;
    const now = Date.now();

    for (const agent of items) {
      if (agent.status === AgentStatus.OFFLINE || agent.status === AgentStatus.DISCONNECTED) continue;
      const lastHeartbeat = new Date(agent.lastHeartbeatAt).getTime();
      if (now - lastHeartbeat > timeoutMs) {
        this.logger.warn({ agentId: agent.id }, "Agent heartbeat timed out; marking OFFLINE");
        await this.agentRepository.update({ ...agent, status: AgentStatus.OFFLINE });
        this.realtimeGateway.broadcastToClients({
          type: "agent:status_changed",
          timestamp: new Date().toISOString(),
          payload: { agentId: agent.id, status: AgentStatus.OFFLINE },
        });
        await this.printerService.markPrintersOfflineForAgent(agent.id);
      }
    }
  }

  private coercePrinterStatus(status: string): PrinterStatus {
    // Heartbeat payloads carry printer status as a plain string (see
    // `HeartbeatRequest.printerStatuses[].status` in print-common); we
    // narrow it defensively here rather than trusting the wire format.
    const values = Object.values(PrinterStatus) as string[];
    return values.includes(status) ? (status as PrinterStatus) : PrinterStatus.UNKNOWN;
  }
}
