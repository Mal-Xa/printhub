import { WsEvent, WsEventType } from "print-common";

export type WsConnectionListener = () => void;
export type WsEventListener<T extends WsEvent = WsEvent> = (event: T) => void;

/**
 * Port over the persistent WebSocket connection to print-server. Every
 * event sent or received through this port is a print-common `WsEvent`
 * variant -- validated against print-common's `wsEventSchema` at the
 * transport boundary, never a locally-invented message shape.
 */
export interface WebSocketTransportPort {
  /**
   * Updates the agent id sent on the `x-agent-id` connection header.
   * Must be called with the server-assigned id before the first
   * `connect()` whenever the transport was constructed before
   * registration completed (e.g. on a fresh install with no
   * previously persisted identity).
   */
  setAgentId(agentId: string): void;
  connect(): void;
  disconnect(): void;
  send(event: WsEvent): void;
  onOpen(listener: WsConnectionListener): void;
  onClose(listener: WsConnectionListener): void;
  /** Registers a listener scoped to one event type discriminant. */
  on<T extends WsEventType>(type: T, listener: WsEventListener<Extract<WsEvent, { type: T }>>): void;
  /** Registers a listener that receives every inbound event, regardless of type. */
  onAny(listener: WsEventListener): void;
}
