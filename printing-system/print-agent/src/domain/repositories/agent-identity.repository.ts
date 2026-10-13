import { AgentIdentity } from "../entities/agent-identity.entity";

export interface AgentIdentityRepository {
  load(): Promise<AgentIdentity | null>;
  save(identity: AgentIdentity): Promise<void>;
}
