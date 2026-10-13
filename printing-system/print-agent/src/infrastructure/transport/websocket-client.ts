import WebSocket from "ws";
import { HTTP_HEADERS, WsEvent, WsEventType, wsEventSchema } from "print-common";
import {
  WebSocketTransportPort,
  WsConnectionListener,
  WsEventListener,
} from "../../domain/ports/websocket-transport.port";
import { LoggerPort } from "../../domain/ports/logger.port";
import { computeBackoffMs } from "../../shared/backoff";

/** Reconnect timing constants for the WebSocket transport (transport-internal, not part of print-common). */
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MULTIPLIER = 2;
const RECONNECT_MAX_MS = 30_000;

export class WebSocketClient implements WebSocketTransportPort {
  private socket: WebSocket | undefined;
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private closedByUser = false;

  private readonly openListeners: WsConnectionListener[] = [];
  private readonly closeListeners: WsConnectionListener[] = [];
  private readonly typedListeners = new Map<WsEventType, WsEventListener[]>();
  private readonly anyListeners: WsEventListener[] = [];

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private agentId: string,
    private readonly logger: LoggerPort
  ) {}

  /**
   * Updates the agent id used on the connection header. Safe to call
   * before the first `connect()` (e.g. once registration resolves the
   * real server-assigned id) or between reconnects.
   */
  setAgentId(agentId: string): void {
    this.agentId = agentId;
  }

  connect(): void {
    this.closedByUser = false;
    this.openSocket();
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  send(event: WsEvent): void {
    const validated = wsEventSchema.safeParse(event);
    if (!validated.success) {
      this.logger.error("Refusing to send malformed WsEvent", { issues: validated.error.issues });
      return;
    }
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.logger.warn("Dropped outbound WsEvent: socket not open", { type: event.type });
      return;
    }
    this.socket.send(JSON.stringify(validated.data));
  }

  onOpen(listener: WsConnectionListener): void {
    this.openListeners.push(listener);
  }

  onClose(listener: WsConnectionListener): void {
    this.closeListeners.push(listener);
  }

  on<T extends WsEventType>(type: T, listener: WsEventListener<Extract<WsEvent, { type: T }>>): void {
    const existing = this.typedListeners.get(type) ?? [];
    // Safe by construction: handleMessage() below only ever invokes a
    // type's listeners after narrowing the event to that exact type.
    existing.push(listener as WsEventListener);
    this.typedListeners.set(type, existing);
  }

  onAny(listener: WsEventListener): void {
    this.anyListeners.push(listener);
  }

  private openSocket(): void {
    const socket = new WebSocket(this.url, {
      headers: {
        [HTTP_HEADERS.AGENT_ID]: this.agentId,
        [HTTP_HEADERS.API_KEY]: this.apiKey,
      },
    });
    this.socket = socket;

    socket.on("open", () => {
      this.reconnectAttempt = 0;
      this.logger.info("WebSocket connection established");
      for (const listener of this.openListeners) listener();
    });

    socket.on("message", (data) => this.handleMessage(data.toString()));

    socket.on("close", (code, reason) => {
      this.logger.warn("WebSocket connection closed", { code, reason: reason.toString() });
      for (const listener of this.closeListeners) listener();
      if (!this.closedByUser) this.scheduleReconnect();
    });

    socket.on("error", (err) => {
      this.logger.warn("WebSocket connection error", { error: String(err) });
    });
  }

  private handleMessage(raw: string): void {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      this.logger.warn("Discarding non-JSON WebSocket message");
      return;
    }

    const result = wsEventSchema.safeParse(parsedJson);
    if (!result.success) {
      this.logger.warn("Discarding WebSocket message that failed print-common schema validation", {
        issues: result.error.issues,
      });
      return;
    }

    const event = result.data as WsEvent;

    if (event.type === "connection:ping") {
      this.send({ type: "connection:pong", timestamp: new Date().toISOString() });
    }

    for (const listener of this.anyListeners) listener(event);
    const typed = this.typedListeners.get(event.type);
    if (typed) {
      for (const listener of typed) listener(event);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt += 1;
    const delay = computeBackoffMs(this.reconnectAttempt, RECONNECT_BASE_MS, RECONNECT_MULTIPLIER, RECONNECT_MAX_MS);
    this.logger.info("Scheduling WebSocket reconnect", { attempt: this.reconnectAttempt, delayMs: delay });
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }
}
