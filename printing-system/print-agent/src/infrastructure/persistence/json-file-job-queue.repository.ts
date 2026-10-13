import { JobId } from "print-common";
import { JobQueueRepository } from "../../domain/repositories/job-queue.repository";
import { LocalJobPhase, LocalJobRecord } from "../../domain/entities/local-job-record.entity";
import { JsonFileStore } from "./json-file-store";

type StoredValue = Record<string, LocalJobRecord>;

export class JsonFileJobQueueRepository implements JobQueueRepository {
  private readonly store: JsonFileStore<StoredValue>;

  constructor(filePath: string) {
    this.store = new JsonFileStore<StoredValue>(filePath, {});
  }

  async add(record: LocalJobRecord): Promise<void> {
    const all = await this.store.read();
    all[record.jobId] = record;
    await this.store.write(all);
  }

  async update(record: LocalJobRecord): Promise<void> {
    const all = await this.store.read();
    all[record.jobId] = record;
    await this.store.write(all);
  }

  async remove(jobId: JobId): Promise<void> {
    const all = await this.store.read();
    delete all[jobId];
    await this.store.write(all);
  }

  async get(jobId: JobId): Promise<LocalJobRecord | null> {
    const all = await this.store.read();
    return all[jobId] ?? null;
  }

  async list(): Promise<LocalJobRecord[]> {
    const all = await this.store.read();
    return Object.values(all);
  }

  async listByPhase(phase: LocalJobPhase): Promise<LocalJobRecord[]> {
    const all = await this.list();
    return all.filter((record) => record.phase === phase);
  }
}
