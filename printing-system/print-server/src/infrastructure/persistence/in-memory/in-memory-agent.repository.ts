import type { AgentId, AgentInfo, PaginatedResult } from "print-common";
import type { AgentListOptions, AgentRepository } from "../../../domain/repositories";

/** In-memory `AgentRepository`. See `InMemoryJobRepository` for swap-out notes. */
export class InMemoryAgentRepository implements AgentRepository {
  private readonly agents = new Map<string, AgentInfo>();

  async create(agent: AgentInfo): Promise<AgentInfo> {
    this.agents.set(agent.id, agent);
    return agent;
  }

  async findById(id: AgentId): Promise<AgentInfo | null> {
    return this.agents.get(id) ?? null;
  }

  async findByHostname(hostname: string): Promise<AgentInfo | null> {
    return (
      Array.from(this.agents.values()).find((agent) => agent.hostname === hostname) ?? null
    );
  }

  async update(agent: AgentInfo): Promise<AgentInfo> {
    this.agents.set(agent.id, agent);
    return agent;
  }

  async list(options: AgentListOptions): Promise<PaginatedResult<AgentInfo>> {
    const items = Array.from(this.agents.values()).sort((a, b) =>
      a.hostname.localeCompare(b.hostname)
    );

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / options.pageSize));
    const start = (options.page - 1) * options.pageSize;
    const pageItems = items.slice(start, start + options.pageSize);

    return {
      items: pageItems,
      pagination: { page: options.page, pageSize: options.pageSize, totalItems, totalPages },
    };
  }
}
