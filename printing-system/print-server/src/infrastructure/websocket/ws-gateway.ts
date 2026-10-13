import type { IncomingMessage, Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { ErrorCode, HTTP_HEADERS, asAgentId, wsEventSchema, type WsEvent } from "print-common";
import type { AgentService } from "../../application/services/agent.service";
import type { JobService } from "../../application/services/job.service";
import type { PrinterService } from "../../application/services/printer.service";
import type { QueueService } from "../../application/services/queue.service";
import type { Logger } from "../logging/logger";
import { ConnectionManager } from "./connection-manager";
import { handleAgentEvent } from "./handlers/agent-events.handler";
import { handleClientEvent } from "./handlers/client-events.handler";

export interface WsGatewayDeps {
  jobService: JobService;
  printerService: PrinterService;
  queueService: QueueService;
  agentService: AgentService;
  logger: Logger;
}

/** Milliseconds between transport-level (ws protocol) ping sweeps. */
const HEARTBEAT_INTERVAL_MS = 30_000;

type SocketRole = "agent" | "client";

interface SocketMeta {
  role: SocketRole;
  /** agentId for agent sockets, generated connection id for client sockets. */
  id: string;
  isAlive: boolean;
}

const socketMeta = new WeakMap<WebSocket, SocketMeta>();

/**
 * Owns the `ws` `WebSocketServer`, identifies each connecting peer as
 * either a print-agent or a print-client, validates every inbound
 * message against print-common's `wsEventSchema`, and delegates
 * business logic to the appropriate handler. All outbound pushes go
 * through `ConnectionManager`, which is the `RealtimeGateway`
 * implementation injected into the application layer.
 */
export class WsGateway {
  private readonly wss: WebSocketServer;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly httpServer: HttpServer,
    private readonly path: string,
    public readonly connectionManager: ConnectionManager,
    private readonly deps: WsGatewayDeps
  ) {
    this.wss = new WebSocketServer({ noServer: true });
  }

  start(): void {
    this.httpServer.on("upgrade", (request, socket, head) => {
      const { pathname } = new URL(request.url ?? "", "http://localhost");
      if (pathname !== this.path) {
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.onConnection(ws, request).catch((error) => {
          this.deps.logger.error({ error }, "Error handling new WebSocket connection");
          ws.close(1011, "internal error");
        });
      });
    });

    this.heartbeatTimer = setInterval(() => this.sweepDeadConnections(), HEARTBEAT_INTERVAL_MS);
    this.deps.logger.info({ path: this.path }, "WebSocket gateway listening");
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.wss.close();
  }

  private async onConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const agentIdHeader = request.headers[HTTP_HEADERS.AGENT_ID];
    const agentIdValue = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;

    if (agentIdValue) {
      const agentId = asAgentId(agentIdValue);
      try {
        await this.deps.agentService.getAgent(agentId);
      } catch {
        this.deps.logger.warn({ agentId }, "Rejected WebSocket connection: unknown agent id");
        ws.close(4001, "unknown agent id");
        return;
      }

      socketMeta.set(ws, { role: "agent", id: agentId, isAlive: true });
      this.connectionManager.registerAgent(agentId, ws);
    } else {
      const connectionId = randomUUID();
      socketMeta.set(ws, { role: "client", id: connectionId, isAlive: true });
      this.connectionManager.registerClient(connectionId, ws);
    }

    ws.on("pong", () => {
      const meta = socketMeta.get(ws);
      if (meta) meta.isAlive = true;
    });

    ws.on("message", (raw) => {
      this.onMessage(ws, raw.toString()).catch((error) => {
        this.deps.logger.error({ error }, "Error handling WebSocket message");
      });
    });

    ws.on("close", () => {
      this.onClose(ws).catch((error) => {
        this.deps.logger.error({ error }, "Error handling WebSocket close");
      });
    });

    ws.on("error", (error) => {
      this.deps.logger.error({ error }, "WebSocket connection error");
    });
  }

  private async onMessage(ws: WebSocket, raw: string): Promise<void> {
    const meta = socketMeta.get(ws);
    if (!meta) return;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      this.sendError(ws, "Message must be valid JSON");
      return;
    }

    const result = wsEventSchema.safeParse(parsedJson);
    if (!result.success) {
      this.deps.logger.debug({ issues: result.error.issues }, "Rejected malformed WebSocket message");
      this.sendError(ws, "Message does not match any known WsEvent schema");
      return;
    }

    const event = result.data as WsEvent;

    if (event.type === "connection:ping") {
      this.reply(ws, { type: "connection:pong", timestamp: new Date().toISOString() });
      return;
    }
    if (event.type === "connection:pong") {
      return;
    }

    if (meta.role === "agent") {
      await handleAgentEvent(
        {
          jobService: this.deps.jobService,
          printerService: this.deps.printerService,
          queueService: this.deps.queueService,
          agentService: this.deps.agentService,
          logger: this.deps.logger,
        },
        meta.id,
        event
      );
    } else {
      await handleClientEvent({ logger: this.deps.logger }, meta.id, event);
    }
  }

  private async onClose(ws: WebSocket): Promise<void> {
    const meta = socketMeta.get(ws);
    if (!meta) return;
    socketMeta.delete(ws);

    if (meta.role === "agent") {
      const agentId = asAgentId(meta.id);
      this.connectionManager.unregisterAgent(agentId);
      await this.deps.agentService.handleDisconnect(agentId);
    } else {
      this.connectionManager.unregisterClient(meta.id);
    }
  }

  private sweepDeadConnections(): void {
    for (const ws of this.wss.clients) {
      const meta = socketMeta.get(ws);
      if (!meta) continue;
      if (!meta.isAlive) {
        ws.terminate();
        continue;
      }
      meta.isAlive = false;
      ws.ping();
    }
  }

  private reply(ws: WebSocket, event: WsEvent): void {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(event));
  }

  private sendError(ws: WebSocket, message: string): void {
    this.reply(ws, {
      type: "connection:error",
      timestamp: new Date().toISOString(),
      payload: {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}
