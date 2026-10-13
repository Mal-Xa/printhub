import { DispatchJobEvent } from "print-common";
import { EnqueueDispatchedJobUseCase } from "./enqueue-dispatched-job.use-case";
import { LoggerPort } from "../../domain/ports/logger.port";

export class HandleDispatchJobUseCase {
  constructor(
    private readonly enqueueDispatchedJob: EnqueueDispatchedJobUseCase,
    private readonly logger: LoggerPort
  ) {}

  async execute(event: DispatchJobEvent): Promise<void> {
    this.logger.info("Received job dispatch", { jobId: event.payload.jobId, printerId: event.payload.printerId });
    await this.enqueueDispatchedJob.execute(event.payload.jobId);
  }
}
