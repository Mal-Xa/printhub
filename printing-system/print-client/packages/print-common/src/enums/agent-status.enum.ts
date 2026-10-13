/**
 * Connectivity/health state of a print-agent instance, as tracked
 * by print-server via registration and heartbeats.
 */
export enum AgentStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  DEGRADED = "DEGRADED",
  REGISTERING = "REGISTERING",
  DISCONNECTED = "DISCONNECTED",
}
