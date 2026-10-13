import { WsEvent } from "print-common";
import { WebSocketTransportPort } from "../domain/ports/websocket-transport.port";
import { LoggerPort } from "../domain/ports/logger.port";
import { HandleDispatchJobUseCase } from "../application/use-cases/handle-dispatch-job.use-case";
import { HandleCancelJobUseCase } from "../application/use-cases/handle-cancel-job.use-case";

/**
 * Thin "controller" layer for inbound WebSocket traffic. Only reacts to
 * the event types that are actually agent-facing per print-common's
 * documented directions (`agent:dispatch_job`, `agent:cancel_job`);
 * everything else (job/printer/agent status broadcasts meant for
 * print-client, ping/pong which the transport already answers,
 * connection errors) is logged at debug level and otherwise ignored.
 */
export class WsEventRouter {
  constructor(
    private readonly wsTransport: WebSocketTransportPort,
    private readonly handleDispatchJob: HandleDispatchJobUseCase,
    private readonly handleCancelJob: HandleCancelJobUseCase,
    private readonly logger: LoggerPort
  ) {}

  attach(): void {
    this.wsTransport.on("agent:dispatch_job", (event) => {
      void this.handleDispatchJob.execute(event).catch((err) =>
        this.logger.error("Error handling agent:dispatch_job", { error: String(err) })
      );
    });

    this.wsTransport.on("agent:cancel_job", (event) => {
      void this.handleCancelJob.execute(event).catch((err) =>
        this.logger.error("Error handling agent:cancel_job", { error: String(err) })
      );
    });

    this.wsTransport.on("connection:error", (event) => {
      this.logger.warn("print-server reported a connection error", { error: event.payload.error });
    });

    this.wsTransport.onAny((event: WsEvent) => {
      this.logger.trace("Inbound WS event", { type: event.type });
    });
  }
}
