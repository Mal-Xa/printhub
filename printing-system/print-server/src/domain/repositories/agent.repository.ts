import type { AgentId, AgentInfo, PaginatedResult } from "print-common";

export interface AgentListOptions {
  page: number;
  pageSize: number;
}

/** Persistence contract for `AgentInfo` records (registered print-agents). */
export interface AgentRepository {
  create(agent: AgentInfo): Promise<AgentInfo>;
  findById(id: AgentId): Promise<AgentInfo | null>;
  findByHostname(hostname: string): Promise<AgentInfo | null>;
  update(agent: AgentInfo): Promise<AgentInfo>;
  list(options: AgentListOptions): Promise<PaginatedResult<AgentInfo>>;
}
