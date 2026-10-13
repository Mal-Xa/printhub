import { AppConfig } from "./config/env";
import { LoggerPort } from "./domain/ports/logger.port";
import { WebSocketTransportPort } from "./domain/ports/websocket-transport.port";
import { IntervalScheduler } from "./infrastructure/scheduler/interval-scheduler";
import { WsEventRouter } from "./interface/ws-event-router";
import { RegisterAgentUseCase } from "./application/use-cases/register-agent.use-case";
import { SendHeartbeatUseCase } from "./application/use-cases/send-heartbeat.use-case";
import { SyncPrintersUseCase } from "./application/use-cases/sync-printers.use-case";
import { ProcessJobQueueUseCase } from "./application/use-cases/process-job-queue.use-case";
import { CleanupTempFilesUseCase } from "./application/use-cases/cleanup-temp-files.use-case";

export interface ApplicationDeps {
  config: AppConfig;
  logger: LoggerPort;
  wsTransport: WebSocketTransportPort;
  wsEventRouter: WsEventRouter;
  registerAgentUseCase: RegisterAgentUseCase;
  sendHeartbeatUseCase: SendHeartbeatUseCase;
  syncPrintersUseCase: SyncPrintersUseCase;
  processJobQueueUseCase: ProcessJobQueueUseCase;
  cleanupTempFilesUseCase: CleanupTempFilesUseCase;
}

/**
 * Top-level composition of the running service: performs the startup
 * sequence (register -> connect -> start schedulers) and owns graceful
 * shutdown. Everything it depends on is injected, so nothing here
 * reaches into infrastructure directly -- see bootstrap/container.ts
 * for the wiring.
 */
export class Application {
  private readonly schedulers: IntervalScheduler[] = [];

  constructor(private readonly deps: ApplicationDeps) {}

  async start(): Promise<void> {
    const { logger, config } = this.deps;
    logger.info("Starting print-agent", { hostname: config.hostname, version: config.agentVersion });

    const { heartbeatIntervalSeconds, agentId } = await this.deps.registerAgentUseCase.execute();

    // Ensures the WebSocket connection authenticates with the real,
    // server-assigned agent id even on a fresh install where the
    // transport was constructed before registration had a chance to
    // persist one (see WebSocketTransportPort.setAgentId).
    this.deps.wsTransport.setAgentId(agentId);

    this.deps.wsTransport.onOpen(() => logger.info("WebSocket connected to print-server"));
    this.deps.wsTransport.onClose(() => logger.warn("WebSocket disconnected from print-server"));
    this.deps.wsEventRouter.attach();
    this.deps.wsTransport.connect();

    this.schedulers.push(
      new IntervalScheduler(
        "heartbeat",
        (heartbeatIntervalSeconds || config.defaultHeartbeatIntervalMs / 1000) * 1000,
        () => this.deps.sendHeartbeatUseCase.execute(),
        logger
      ),
      new IntervalScheduler(
        "printer-detection",
        config.printerDetectionIntervalMs,
        () => this.deps.syncPrintersUseCase.execute(),
        logger
      ),
      new IntervalScheduler(
        "queue-worker",
        config.queuePollIntervalMs,
        () => this.deps.processJobQueueUseCase.execute(),
        logger
      ),
      new IntervalScheduler(
        "temp-file-cleanup",
        config.cleanupIntervalMs,
        () => this.deps.cleanupTempFilesUseCase.execute(),
        logger
      )
    );

    for (const scheduler of this.schedulers) scheduler.start();
    logger.info("print-agent started");
  }

  async stop(): Promise<void> {
    this.deps.logger.info("Stopping print-agent");
    for (const scheduler of this.schedulers) scheduler.stop();
    this.deps.wsTransport.disconnect();
  }
}
