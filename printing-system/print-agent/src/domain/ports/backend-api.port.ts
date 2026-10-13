import {
  AgentRegistrationRequest,
  AgentRegistrationResponse,
  GetJobResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  JobId,
} from "print-common";

/**
 * Port over print-server's REST API. print-agent is a client of this
 * API, never a provider of one -- there is no HTTP server inside this
 * service. Every request/response shape is imported directly from
 * print-common; this port adds no fields of its own.
 */
export interface BackendApiPort {
  registerAgent(request: AgentRegistrationRequest): Promise<AgentRegistrationResponse>;
  sendHeartbeat(request: HeartbeatRequest): Promise<HeartbeatResponse>;
  /** Fetches the full canonical job record (needed after a WS dispatch, which only carries the job id). */
  getJob(jobId: JobId): Promise<GetJobResponse>;
}
