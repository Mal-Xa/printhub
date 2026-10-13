import { AgentStatus } from "../enums";
import { AgentId, PrinterId } from "../utils";

/**
 * Canonical representation of a registered print-agent instance, as
 * tracked by print-server.
 */
export interface AgentInfo {
  id: AgentId;
  hostname: string;
  version: string;
  status: AgentStatus;
  /** IDs of printers currently managed by this agent. */
  managedPrinterIds: PrinterId[];
  /** ISO 8601 timestamp. */
  registeredAt: string;
  /** ISO 8601 timestamp of the last heartbeat received from this agent. */
  lastHeartbeatAt: string;
}

/** Minimal identity of a user, shared between print-client and print-server. */
export interface UserRef {
  id: string;
  displayName: string;
  email?: string;
}
