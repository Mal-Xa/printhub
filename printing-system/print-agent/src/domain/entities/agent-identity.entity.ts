import { AgentId, PrinterId } from "print-common";

/**
 * Identity this agent process persists across restarts so it can
 * re-identify itself to print-server without rebuilding all context
 * from scratch. This is NOT print-common's `AgentInfo` (that is the
 * server's canonical record of the agent) -- it's the small subset of
 * that relationship the agent itself needs to remember locally.
 */
export interface AgentIdentity {
  agentId: AgentId;
  hostname: string;
  /** ISO 8601 timestamp of the most recent successful registration. */
  registeredAt: string;
  /** Maps a locally-detected printer name (as CUPS knows it) to the PrinterId print-server assigned it. */
  printerIdByLocalName: Record<string, PrinterId>;
}
