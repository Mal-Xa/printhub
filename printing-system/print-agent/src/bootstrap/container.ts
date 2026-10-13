import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadConfig } from "../config/env";
import { PinoLogger } from "../infrastructure/logging/pino-logger";
import { JsonFileAgentIdentityRepository } from "../infrastructure/persistence/json-file-agent-identity.repository";
import { JsonFileJobQueueRepository } from "../infrastructure/persistence/json-file-job-queue.repository";
import { JsonFilePrinterRepository } from "../infrastructure/persistence/json-file-printer.repository";
import { CupsPrintingSystem } from "../infrastructure/printing/cups-printing-system";
import { HttpFileDownloader } from "../infrastructure/files/http-file-downloader";
import { BackendApiClient } from "../infrastructure/transport/backend-api-client";
import { WebSocketClient } from "../infrastructure/transport/websocket-client";
import { WsEventRouter } from "../interface/ws-event-router";
import { RegisterAgentUseCase } from "../application/use-cases/register-agent.use-case";
import { SendHeartbeatUseCase } from "../application/use-cases/send-heartbeat.use-case";
import { SyncPrintersUseCase } from "../application/use-cases/sync-printers.use-case";
import { EnqueueDispatchedJobUseCase } from "../application/use-cases/enqueue-dispatched-job.use-case";
import { HandleDispatchJobUseCase } from "../application/use-cases/handle-dispatch-job.use-case";
import { HandleCancelJobUseCase } from "../application/use-cases/handle-cancel-job.use-case";
import { HandleJobFailureUseCase } from "../application/use-cases/handle-job-failure.use-case";
import { DownloadJobFileUseCase } from "../application/use-cases/download-job-file.use-case";
import { PrintJobUseCase } from "../application/use-cases/print-job.use-case";
import { PollPrintProgressUseCase } from "../application/use-cases/poll-print-progress.use-case";
import { ProcessJobQueueUseCase } from "../application/use-cases/process-job-queue.use-case";
import { CleanupTempFilesUseCase } from "../application/use-cases/cleanup-temp-files.use-case";
import { ReportJobStatusUseCase } from "../application/use-cases/report-job-status.use-case";
import { Application } from "../app";

export interface Container {
  app: Application;
}

/**
 * Manual dependency injection: instantiate every port implementation,
 * then every use case that depends on those ports, then the
 * Application that orchestrates them. No DI framework -- for a
 * service this size, explicit wiring is easier to read and to run on
 * constrained hardware than reflection-based DI.
 */
export async function buildContainer(): Promise<Container> {
  const config = loadConfig();
  const logger = PinoLogger.create(config.logLevel);

  await fs.mkdir(config.stateDir, { recursive: true });
  await fs.mkdir(config.downloadDir, { recursive: true });

  // --- Repositories -------------------------------------------------
  const agentIdentityRepo = new JsonFileAgentIdentityRepository(path.join(config.stateDir, "identity.json"));
  const jobQueueRepo = new JsonFileJobQueueRepository(path.join(config.stateDir, "queue.json"));
  const printerRepo = new JsonFilePrinterRepository(path.join(config.stateDir, "printers.json"));

  // --- Infrastructure adapters ---------------------------------------
  const printingSystem = new CupsPrintingSystem(logger.child({ module: "cups" }));
  const fileDownloader = new HttpFileDownloader(logger.child({ module: "download" }), config.apiKey);
  const backendApi = new BackendApiClient(config.serverHttpUrl, config.apiKey, logger.child({ module: "api" }));

  // WebSocket client needs the agent's id for its connection headers; it may
  // not exist yet on a first-ever run, so fall back to the hostname until
  // registration completes and persists a real agentId for next time.
  const priorIdentity = await agentIdentityRepo.load();
  const wsTransport = new WebSocketClient(
    config.serverWsUrl,
    config.apiKey,
    priorIdentity?.agentId ?? config.hostname,
    logger.child({ module: "ws" })
  );

  // --- Use cases -------------------------------------------------------
  const reportJobStatus = new ReportJobStatusUseCase(wsTransport);

  const registerAgentUseCase = new RegisterAgentUseCase(
    printingSystem,
    backendApi,
    agentIdentityRepo,
    printerRepo,
    config.hostname,
    config.agentVersion,
    logger.child({ module: "register-agent" })
  );

  const enqueueDispatchedJobUseCase = new EnqueueDispatchedJobUseCase(
    backendApi,
    agentIdentityRepo,
    jobQueueRepo,
    reportJobStatus,
    logger.child({ module: "enqueue-job" })
  );

  const handleDispatchJobUseCase = new HandleDispatchJobUseCase(
    enqueueDispatchedJobUseCase,
    logger.child({ module: "dispatch-job" })
  );

  const handleJobFailureUseCase = new HandleJobFailureUseCase(
    jobQueueRepo,
    reportJobStatus,
    logger.child({ module: "job-failure" })
  );

  const handleCancelJobUseCase = new HandleCancelJobUseCase(
    jobQueueRepo,
    printingSystem,
    reportJobStatus,
    logger.child({ module: "cancel-job" })
  );

  const downloadJobFileUseCase = new DownloadJobFileUseCase(
    fileDownloader,
    jobQueueRepo,
    handleJobFailureUseCase,
    config.downloadDir,
    logger.child({ module: "download-job" })
  );

  const printJobUseCase = new PrintJobUseCase(
    printingSystem,
    jobQueueRepo,
    agentIdentityRepo,
    handleJobFailureUseCase,
    reportJobStatus,
    logger.child({ module: "print-job" })
  );

  const pollPrintProgressUseCase = new PollPrintProgressUseCase(
    printingSystem,
    jobQueueRepo,
    handleJobFailureUseCase,
    reportJobStatus,
    logger.child({ module: "poll-progress" })
  );

  const processJobQueueUseCase = new ProcessJobQueueUseCase(
    jobQueueRepo,
    downloadJobFileUseCase,
    printJobUseCase,
    pollPrintProgressUseCase,
    logger.child({ module: "queue-worker" })
  );

  const sendHeartbeatUseCase = new SendHeartbeatUseCase(
    backendApi,
    agentIdentityRepo,
    printerRepo,
    enqueueDispatchedJobUseCase,
    logger.child({ module: "heartbeat" })
  );

  const syncPrintersUseCase = new SyncPrintersUseCase(
    printingSystem,
    printerRepo,
    agentIdentityRepo,
    wsTransport,
    registerAgentUseCase,
    logger.child({ module: "sync-printers" })
  );

  const cleanupTempFilesUseCase = new CleanupTempFilesUseCase(
    jobQueueRepo,
    config.downloadDir,
    config.tempFileMaxAgeMinutes,
    logger.child({ module: "cleanup" })
  );

  const wsEventRouter = new WsEventRouter(
    wsTransport,
    handleDispatchJobUseCase,
    handleCancelJobUseCase,
    logger.child({ module: "ws-router" })
  );

  const app = new Application({
    config,
    logger,
    wsTransport,
    wsEventRouter,
    registerAgentUseCase,
    sendHeartbeatUseCase,
    syncPrintersUseCase,
    processJobQueueUseCase,
    cleanupTempFilesUseCase,
  });

  return { app };
}
