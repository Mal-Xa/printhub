import type { WsEvent } from "print-common";
import type { Logger } from "../../logging/logger";

export interface ClientEventHandlerDeps {
  logger: Logger;
}

/**
 * Routes a validated `WsEvent` received from a connected print-client.
 * Clients are primarily receivers (job/printer/agent/queue updates
 * pushed by the server); ping/pong is handled by the gateway itself.
 * Any other event type from a client is unexpected and only logged.
 */
export async function handleClientEvent(
  deps: ClientEventHandlerDeps,
  connectionId: string,
  event: WsEvent
): Promise<void> {
  switch (event.type) {
    case "connection:error": {
      deps.logger.warn({ connectionId, error: event.payload.error }, "Client reported a connection error");
      return;
    }
    default: {
      deps.logger.debug(
        { connectionId, type: event.type },
        "Ignoring client-originated event (clients are receivers for this event type)"
      );
    }
  }
}
