import { createServer } from "node:http";
import { buildContainer } from "./config/container";
import { AGENT_HEARTBEAT } from "print-common";

async function main(): Promise<void> {
  const container = buildContainer();
  const { config, logger, httpApp, fileStorage, createWsGateway, agentService } = container;

  await fileStorage.init();

  const httpServer = createServer(httpApp);
  const wsGateway = createWsGateway(httpServer);
  wsGateway.start();

  const staleAgentSweepMs = AGENT_HEARTBEAT.TIMEOUT_SECONDS * 1000;
  const sweepTimer = setInterval(() => {
    agentService.sweepStaleAgents().catch((error) => {
      logger.error({ error }, "Failed to sweep stale agents");
    });
  }, staleAgentSweepMs);

  httpServer.listen(config.port, config.host, () => {
    logger.info(
      { port: config.port, host: config.host, wsPath: config.wsPath, env: config.nodeEnv },
      "print-server listening"
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "Shutting down print-server");
    clearInterval(sweepTimer);
    wsGateway.stop();
    httpServer.close((err) => {
      if (err) {
        logger.error({ err }, "Error during HTTP server shutdown");
        process.exit(1);
      }
      process.exit(0);
    });
    // Force-exit if graceful shutdown hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled promise rejection");
  });
  process.on("uncaughtException", (error) => {
    logger.error({ error }, "Uncaught exception");
    process.exit(1);
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error during startup:", error);
  process.exit(1);
});
