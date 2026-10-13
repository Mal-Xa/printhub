import { HeartbeatRequest } from "print-common";
import { BackendApiPort } from "../../domain/ports/backend-api.port";
import { AgentIdentityRepository } from "../../domain/repositories/agent-identity.repository";
import { PrinterRepository } from "../../domain/repositories/printer.repository";
import { LoggerPort } from "../../domain/ports/logger.port";
import { EnqueueDispatchedJobUseCase } from "./enqueue-dispatched-job.use-case";

export class SendHeartbeatUseCase {
  constructor(
    private readonly backendApi: BackendApiPort,
    private readonly agentIdentityRepo: AgentIdentityRepository,
    private readonly printerRepo: PrinterRepository,
    private readonly enqueueDispatchedJob: EnqueueDispatchedJobUseCase,
    private readonly logger: LoggerPort
  ) {}

  async execute(): Promise<void> {
    const identity = await this.agentIdentityRepo.load();
    if (!identity) {
      this.logger.debug("Skipping heartbeat: agent not yet registered");
      return;
    }

    const printers = await this.printerRepo.list();
    const request: HeartbeatRequest = {
      agentId: identity.agentId,
      sentAt: new Date().toISOString(),
      printerStatuses: printers
        .filter((printer) => printer.printerId !== undefined)
        .map((printer) => ({ printerId: printer.printerId as NonNullable<typeof printer.printerId>, status: printer.status })),
    };

    const response = await this.backendApi.sendHeartbeat(request);
    this.logger.debug("Heartbeat acknowledged", { pendingJobs: response.pendingJobIds.length });

    // Reconcile: pick up any job print-server considers pending for us
    // that we somehow missed (e.g. a dispatch WS event during a brief
    // disconnect). Cheap safety net on top of the WS dispatch path.
    for (const jobId of response.pendingJobIds) {
      await this.enqueueDispatchedJob.execute(jobId);
    }
  }
}
