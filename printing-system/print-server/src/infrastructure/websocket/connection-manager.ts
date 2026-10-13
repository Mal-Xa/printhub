import type WebSocket from "ws";
import type { AgentId, JobId, PrinterId, WsEvent } from "print-common";
import { AgentUnreachableError } from "../../domain/errors";
import type { RealtimeGateway } from "../../domain/gateways";
import type { Logger } from "../logging/logger";

interface ClientConnection {
  id: string;
  socket: WebSocket;
}

/**
 * Tracks every live WebSocket connection (print-agents keyed by
 * `AgentId`, print-clients keyed by a generated connection id) and
 * implements `RealtimeGateway` so the application layer can push
 * events without depending on the `ws` library directly.
 */
export class ConnectionManager implements RealtimeGateway {
  private readonly agentSockets = new Map<string, WebSocket>();
  private readonly clientConnections = new Map<string, ClientConnection>();

  constructor(private readonly logger: Logger) {}

  registerAgent(agentId: AgentId, socket: WebSocket): void {
    const existing = this.agentSockets.get(agentId);
    if (existing && existing.readyState === existing.OPEN) {
      existing.terminate();
    }
    this.agentSockets.set(agentId, socket);
    this.logger.info({ agentId }, "Agent connected");
  }

  unregisterAgent(agentId: AgentId): void {
    this.agentSockets.delete(agentId);
    this.logger.info({ agentId }, "Agent disconnected");
  }

  registerClient(connectionId: string, socket: WebSocket): void {
    this.clientConnections.set(connectionId, { id: connectionId, socket });
    this.logger.debug({ connectionId }, "Client connected");
  }

  unregisterClient(connectionId: string): void {
    this.clientConnections.delete(connectionId);
    this.logger.debug({ connectionId }, "Client disconnected");
  }

  isAgentConnected(agentId: AgentId): boolean {
    const socket = this.agentSockets.get(agentId);
    return !!socket && socket.readyState === socket.OPEN;
  }

  async dispatchJobToAgent(agentId: AgentId, jobId: JobId, printerId: PrinterId): Promise<void> {
    const socket = this.agentSockets.get(agentId);
    if (!socket || socket.readyState !== socket.OPEN) {
      throw new AgentUnreachableError(agentId);
    }
    const event: WsEvent = {
      type: "agent:dispatch_job",
      timestamp: new Date().toISOString(),
      payload: { jobId, printerId },
    };
    this.send(socket, event);
  }

  async cancelJobOnAgent(agentId: AgentId, jobId: JobId): Promise<void> {
    const socket = this.agentSockets.get(agentId);
    if (!socket || socket.readyState !== socket.OPEN) {
      this.logger.warn({ agentId, jobId }, "Cannot forward cancel: agent not connected");
      return;
    }
    const event: WsEvent = {
      type: "agent:cancel_job",
      timestamp: new Date().toISOString(),
      payload: { jobId },
    };
    this.send(socket, event);
  }

  broadcastToClients(event: WsEvent): void {
    for (const { socket } of this.clientConnections.values()) {
      this.send(socket, event);
    }
  }

  broadcastToAgents(event: WsEvent): void {
    for (const socket of this.agentSockets.values()) {
      this.send(socket, event);
    }
  }

  private send(socket: WebSocket, event: WsEvent): void {
    if (socket.readyState !== socket.OPEN) return;
    try {
      socket.send(JSON.stringify(event));
    } catch (error) {
      this.logger.error({ error }, "Failed to send WebSocket event");
    }
  }
}
