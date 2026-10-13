import { JobId, JobStatus, JobStatusChangedEvent } from "print-common";
import { WebSocketTransportPort } from "../../domain/ports/websocket-transport.port";

/**
 * Reports a job status transition to print-server.
 *
 * print-common documents `JobStatusChangedEvent` as "print-server ->
 * print-client" -- there is no distinct agent-outbound event for this
 * in the current contract (see docs/PRINT_COMMON_GAPS.md). Rather than
 * inventing a duplicate shape for the reverse direction, this reuses
 * the existing event type: the wire shape print-agent needs to convey
 * ("this job's status is now X") is identical to what print-server
 * already broadcasts, and it validates against the same
 * `wsEventSchema`. print-server is expected to treat an inbound
 * message of this type, from an authenticated agent connection, as a
 * status report rather than rebroadcast it verbatim.
 */
export class ReportJobStatusUseCase {
  constructor(private readonly wsTransport: WebSocketTransportPort) {}

  execute(jobId: JobId, status: JobStatus, message?: string): void {
    const event: JobStatusChangedEvent = {
      type: "job:status_changed",
      timestamp: new Date().toISOString(),
      payload: { jobId, status, message },
    };
    this.wsTransport.send(event);
  }
}
