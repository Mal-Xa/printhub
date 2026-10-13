import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import type { AppConfig } from "../../config/env";
import type { Logger } from "../../infrastructure/logging/logger";
import type { AgentsController } from "./controllers/agents.controller";
import type { FilesController } from "./controllers/files.controller";
import type { JobsController } from "./controllers/jobs.controller";
import type { PrintersController } from "./controllers/printers.controller";
import type { UploadController } from "./controllers/upload.controller";
import { errorHandler, notFoundMiddleware, requestIdMiddleware } from "./middlewares";
import { buildAgentsRouter } from "./routes/agents.routes";
import { buildFilesRouter } from "./routes/files.routes";
import { buildJobsRouter } from "./routes/jobs.routes";
import { buildPrintersRouter } from "./routes/printers.routes";
import { buildUploadRouter } from "./routes/upload.routes";

export interface HttpAppDeps {
  config: AppConfig;
  logger: Logger;
  jobsController: JobsController;
  printersController: PrintersController;
  agentsController: AgentsController;
  uploadController: UploadController;
  filesController: FilesController;
}

/**
 * Builds the fully wired Express application. Pure composition: all
 * business logic already lives in the application/domain layers, so
 * this function only assembles middleware, routers, and the two
 * cross-cutting handlers (404, error).
 */
export function buildHttpApp(deps: HttpAppDeps): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: deps.config.corsOrigin }));
  app.use(requestIdMiddleware);
  app.use(pinoHttp({ logger: deps.logger, autoLogging: deps.config.nodeEnv !== "test" }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", service: "print-server", timestamp: new Date().toISOString() });
  });

  app.use("/api/jobs", buildJobsRouter(deps.jobsController));
  app.use("/api/printers", buildPrintersRouter(deps.printersController));
  app.use("/api/agents", buildAgentsRouter(deps.agentsController));
  app.use("/api/uploads", buildUploadRouter(deps.uploadController, deps.config.maxDocumentSizeBytes));
  app.use("/api/files", buildFilesRouter(deps.filesController));

  app.use(notFoundMiddleware);
  app.use(errorHandler(deps.logger));

  return app;
}
