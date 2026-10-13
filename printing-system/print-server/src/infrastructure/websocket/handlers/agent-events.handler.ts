import { asJobId, asPrinterId, type WsEvent } from "print-common";
import type { AgentService } from "../../../application/services/agent.service";
import type { JobService } from "../../../application/services/job.service";
import type { PrinterService } from "../../../application/services/printer.service";
import type { QueueService } from "../../../application/services/queue.service";
import type { Logger } from "../../logging/logger";

export interface AgentEventHandlerDeps {
  jobService: JobService;
  printerService: PrinterService;
  queueService: QueueService;
  agentService: AgentService;
  logger: Logger;
}

/**
 * Routes a validated `WsEvent` received from a connected print-agent
 * to the appropriate application service. Ping/pong and malformed
 * messages are handled by the gateway itself before reaching here.
 */
export async function handleAgentEvent(
  deps: AgentEventHandlerDeps,
  agentId: string,
  event: WsEvent
): Promise<void> {
  switch (event.type) {
    case "job:status_changed": {
      await deps.jobService.applyStatusUpdate(
        asJobId(event.payload.jobId),
        event.payload.status,
        event.payload.message
      );
      return;
    }

    case "job:progress": {
      await deps.jobService.applyProgress(
        asJobId(event.payload.jobId),
        event.payload.pagesPrinted,
        event.payload.totalPages
      );
      return;
    }

    case "printer:status_changed": {
      const printerId = asPrinterId(event.payload.printerId);
      await deps.printerService.updateStatus(printerId, event.payload.status);
      // Printer freeing up (e.g. BUSY -> ONLINE) may unblock queued jobs.
      await deps.queueService.dispatchNext(printerId);
      return;
    }

    case "printer:discovered": {
      deps.logger.info(
        { agentId, printerId: event.payload.printerId },
        "Agent reported a discovered printer"
      );
      return;
    }

    case "connection:error": {
      deps.logger.warn({ agentId, error: event.payload.error }, "Agent reported a connection error");
      return;
    }

    default: {
      deps.logger.warn({ agentId, type: event.type }, "Unexpected event type received from agent");
    }
  }
}
