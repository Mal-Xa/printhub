import { AgentIdentityRepository } from "../../domain/repositories/agent-identity.repository";
import { AgentIdentity } from "../../domain/entities/agent-identity.entity";
import { JsonFileStore } from "./json-file-store";

type StoredValue = AgentIdentity | null;

export class JsonFileAgentIdentityRepository implements AgentIdentityRepository {
  private readonly store: JsonFileStore<StoredValue>;

  constructor(filePath: string) {
    this.store = new JsonFileStore<StoredValue>(filePath, null);
  }

  async load(): Promise<AgentIdentity | null> {
    return this.store.read();
  }

  async save(identity: AgentIdentity): Promise<void> {
    await this.store.write(identity);
  }
}
