import { JobId } from "print-common";
import { LocalJobPhase, LocalJobRecord } from "../entities/local-job-record.entity";

export interface JobQueueRepository {
  add(record: LocalJobRecord): Promise<void>;
  update(record: LocalJobRecord): Promise<void>;
  remove(jobId: JobId): Promise<void>;
  get(jobId: JobId): Promise<LocalJobRecord | null>;
  list(): Promise<LocalJobRecord[]>;
  listByPhase(phase: LocalJobPhase): Promise<LocalJobRecord[]>;
}
