import type { Server as HttpServer } from "node:http";
import type { Express } from "express";
import { config as defaultConfig, type AppConfig } from "./env";
import { logger as defaultLogger, type Logger } from "../infrastructure/logging/logger";
import {
  InMemoryAgentRepository,
  InMemoryJobRepository,
  InMemoryPrinterRepository,
  InMemoryQueueRepository,
  InMemoryUploadedFileRepository,
} from "../infrastructure/persistence/in-memory";
import { LocalFileStorage } from "../infrastructure/storage/local-file-storage";
import { ConnectionManager, WsGateway } from "../infrastructure/websocket";
import {
  AgentService,
  JobService,
  PrinterService,
  QueueService,
  UploadService,
} from "../application/services";
import {
  AgentsController,
  FilesController,
  JobsController,
  PrintersController,
  UploadController,
} from "../presentation/http/controllers";
import { buildHttpApp } from "../presentation/http/app";

/**
 * Everything the running process needs, wired together by hand
 * (constructor injection, composition-root style -- no reflection /
 * decorator-based DI framework required). Every service depends only
 * on interfaces (`domain/repositories`, `domain/gateways`); swapping
 * an in-memory repository for a database-backed one means changing a
 * single `new InMemoryXxxRepository()` call below.
 */
export interface AppContainer {
  config: AppConfig;
  logger: Logger;
  httpApp: Express;
  connectionManager: ConnectionManager;
  createWsGateway: (httpServer: HttpServer) => WsGateway;
  fileStorage: LocalFileStorage;
  agentService: AgentService;
}

export function buildContainer(
  config: AppConfig = defaultConfig,
  logger: Logger = defaultLogger
): AppContainer {
  // --- Persistence (swap these for real implementations as needed) ---
  const jobRepository = new InMemoryJobRepository();
  const printerRepository = new InMemoryPrinterRepository();
  const agentRepository = new InMemoryAgentRepository();
  const queueRepository = new InMemoryQueueRepository();
  const uploadedFileRepository = new InMemoryUploadedFileRepository();
  const fileStorage = new LocalFileStorage(config.uploadDir, logger);

  // --- Realtime transport ---
  const connectionManager = new ConnectionManager(logger);

  // --- Application services (constructor-injected with the interfaces above) ---
  const printerService = new PrinterService(printerRepository, connectionManager, logger);
  const queueService = new QueueService(
    jobRepository,
    queueRepository,
    printerRepository,
    connectionManager,
    logger
  );
  const uploadService = new UploadService(
    fileStorage,
    uploadedFileRepository,
    config.maxDocumentSizeBytes,
    config.publicBaseUrl,
    logger
  );
  const jobService = new JobService(
    jobRepository,
    printerRepository,
    uploadService,
    queueService,
    connectionManager,
    logger
  );
  const agentService = new AgentService(agentRepository, printerService, connectionManager, logger);

  // --- HTTP presentation ---
  const jobsController = new JobsController(jobService);
  const printersController = new PrintersController(printerService, queueService);
  const agentsController = new AgentsController(agentService);
  const uploadController = new UploadController(uploadService);
  const filesController = new FilesController(uploadService);

  const httpApp = buildHttpApp({
    config,
    logger,
    jobsController,
    printersController,
    agentsController,
    uploadController,
    filesController,
  });

  const createWsGateway = (httpServer: HttpServer): WsGateway =>
    new WsGateway(httpServer, config.wsPath, connectionManager, {
      jobService,
      printerService,
      queueService,
      agentService,
      logger,
    });

  return {
    config,
    logger,
    httpApp,
    connectionManager,
    createWsGateway,
    fileStorage,
    agentService,
  };
}
