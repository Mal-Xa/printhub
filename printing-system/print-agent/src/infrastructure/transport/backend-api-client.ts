import { randomUUID } from "node:crypto";
import {
  AgentRegistrationRequest,
  AgentRegistrationResponse,
  ApiErrorResponse,
  GetJobResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  HTTP_HEADERS,
  JobId,
} from "print-common";
import { BackendApiPort } from "../../domain/ports/backend-api.port";
import { LoggerPort } from "../../domain/ports/logger.port";

/**
 * REST routes this client assumes print-server exposes. print-common
 * defines the request/response *payload* shapes but not route paths
 * (by design -- routing is a print-server concern, not a shared
 * model), so these are this agent's assumption about the API surface.
 * Adjust here if print-server's actual routes differ.
 */
const ROUTES = {
  register: "/api/agents/register",
  heartbeat: (agentId: string) => `/api/agents/${encodeURIComponent(agentId)}/heartbeat`,
  job: (jobId: string) => `/api/jobs/${encodeURIComponent(jobId)}`,
};

export class BackendApiClient implements BackendApiPort {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly logger: LoggerPort
  ) {}

  async registerAgent(request: AgentRegistrationRequest): Promise<AgentRegistrationResponse> {
    return this.request<AgentRegistrationResponse>("POST", ROUTES.register, request);
  }

  async sendHeartbeat(request: HeartbeatRequest): Promise<HeartbeatResponse> {
    return this.request<HeartbeatResponse>("POST", ROUTES.heartbeat(request.agentId), request);
  }

  async getJob(jobId: JobId): Promise<GetJobResponse> {
    return this.request<GetJobResponse>("GET", ROUTES.job(jobId));
  }

  private async request<T>(method: "GET" | "POST", routePath: string, body?: unknown): Promise<T> {
    const requestId = randomUUID();
    const response = await fetch(`${this.baseUrl}${routePath}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        [HTTP_HEADERS.API_KEY]: this.apiKey,
        [HTTP_HEADERS.REQUEST_ID]: requestId,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const json = text.length > 0 ? (JSON.parse(text) as unknown) : undefined;

    if (!response.ok) {
      const errorBody = json as ApiErrorResponse | undefined;
      const message = errorBody?.error?.message ?? `HTTP ${response.status}`;
      this.logger.error("print-server API request failed", {
        method,
        route: routePath,
        requestId,
        status: response.status,
        code: errorBody?.error?.code,
      });
      throw new Error(`print-server API error [${routePath}]: ${message}`);
    }

    return json as T;
  }
}
