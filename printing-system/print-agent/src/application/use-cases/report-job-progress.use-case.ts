import { JobId, JobProgressEvent } from "print-common";
import { WebSocketTransportPort } from "../../domain/ports/websocket-transport.port";

/**
 * Reports page-level progress for a printing job, reusing
 * print-common's `JobProgressEvent` the same way ReportJobStatusUseCase
 * reuses `JobStatusChangedEvent` (see that file's doc comment).
 *
 * Note: CUPS does not reliably expose per-page progress through its
 * command-line tools, so in practice this is only called when a driver
 * happens to report it; most jobs will only ever emit the coarser
 * status transitions from ReportJobStatusUseCase. See
 * docs/PRINT_COMMON_GAPS.md for a suggested improvement here.
 */
export class ReportJobProgressUseCase {
  constructor(private readonly wsTransport: WebSocketTransportPort) {}

  execute(jobId: JobId, pagesPrinted: number, totalPages: number): void {
    const event: JobProgressEvent = {
      type: "job:progress",
      timestamp: new Date().toISOString(),
      payload: { jobId, pagesPrinted, totalPages },
    };
    this.wsTransport.send(event);
  }
}
