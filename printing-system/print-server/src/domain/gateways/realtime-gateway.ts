import type { AgentId, JobId, PrinterId, WsEvent } from "print-common";

/**
 * Port through which the application layer talks to connected
 * WebSocket peers (print-agents and print-clients), without knowing
 * anything about the `ws` library, socket lifecycle, or transport.
 * Implemented by the WebSocket infrastructure's `ConnectionManager`.
 */
export interface RealtimeGateway {
  /** Whether a given agent currently has a live WebSocket connection. */
  isAgentConnected(agentId: AgentId): boolean;

  /** Pushes a `DispatchJobEvent` to the given agent. Throws if the agent is not connected. */
  dispatchJobToAgent(agentId: AgentId, jobId: JobId, printerId: PrinterId): Promise<void>;

  /** Pushes a `CancelJobEvent` to the given agent, if connected. No-ops otherwise. */
  cancelJobOnAgent(agentId: AgentId, jobId: JobId): Promise<void>;

  /** Broadcasts an event to every connected print-client. */
  broadcastToClients(event: WsEvent): void;

  /** Broadcasts an event to every connected print-agent. */
  broadcastToAgents(event: WsEvent): void;
}
