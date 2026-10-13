import "dotenv/config";
import { buildContainer } from "./bootstrap/container";

async function main(): Promise<void> {
  const { app } = await buildContainer();

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down gracefully...`);
    app
      .stop()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error("Error during shutdown", err);
        process.exit(1);
      });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    // eslint-disable-next-line no-console
    console.error("uncaughtException", err);
  });
  process.on("unhandledRejection", (reason) => {
    // eslint-disable-next-line no-console
    console.error("unhandledRejection", reason);
  });

  await app.start();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error during startup", err);
  process.exit(1);
});
