import pino from "pino";
import { config } from "../../config/env";

/**
 * Application-wide structured logger. Every module that needs to log
 * should create a child logger via `logger.child({ module: "..." })`
 * rather than instantiating pino directly, so log lines stay
 * consistently tagged and easy to filter.
 */
export const logger = pino({
  level: config.logLevel,
  transport:
    config.nodeEnv === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
  base: { service: "print-server" },
});

export type Logger = typeof logger;
