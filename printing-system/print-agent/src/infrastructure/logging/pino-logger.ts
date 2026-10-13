import pino, { Logger } from "pino";
import { LoggerPort } from "../../domain/ports/logger.port";

export class PinoLogger implements LoggerPort {
  private constructor(private readonly logger: Logger) {}

  static create(level: string): PinoLogger {
    const logger = pino({
      level,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      },
    });
    return new PinoLogger(logger);
  }

  trace(msg: string, meta?: Record<string, unknown>): void {
    this.logger.trace(meta ?? {}, msg);
  }
  debug(msg: string, meta?: Record<string, unknown>): void {
    this.logger.debug(meta ?? {}, msg);
  }
  info(msg: string, meta?: Record<string, unknown>): void {
    this.logger.info(meta ?? {}, msg);
  }
  warn(msg: string, meta?: Record<string, unknown>): void {
    this.logger.warn(meta ?? {}, msg);
  }
  error(msg: string, meta?: Record<string, unknown>): void {
    this.logger.error(meta ?? {}, msg);
  }
  child(bindings: Record<string, unknown>): LoggerPort {
    return new PinoLogger(this.logger.child(bindings));
  }
}
