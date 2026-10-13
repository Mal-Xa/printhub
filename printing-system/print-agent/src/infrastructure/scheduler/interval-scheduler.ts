import { LoggerPort } from "../../domain/ports/logger.port";

/**
 * Runs `task` on a fixed interval, catching and logging errors so one
 * failed run never kills the interval (and never crashes the process).
 */
export class IntervalScheduler {
  private handle: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly name: string,
    private readonly intervalMs: number,
    private readonly task: () => Promise<void> | void,
    private readonly logger: LoggerPort
  ) {}

  start(runImmediately = true): void {
    if (runImmediately) void this.runSafely();
    this.handle = setInterval(() => void this.runSafely(), this.intervalMs);
  }

  stop(): void {
    if (this.handle) clearInterval(this.handle);
  }

  private async runSafely(): Promise<void> {
    if (this.running) return; // avoid overlapping runs if one tick takes longer than the interval
    this.running = true;
    try {
      await this.task();
    } catch (err) {
      this.logger.error(`Scheduled task "${this.name}" failed`, { error: String(err) });
    } finally {
      this.running = false;
    }
  }
}
