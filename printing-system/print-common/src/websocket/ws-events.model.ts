import { JobStatus, PrinterStatus, AgentStatus } from "../enums";
import { JobId, PrinterId, AgentId } from "../utils";
import { AppError } from "../errors";

/** Every WebSocket event carries a discriminant `type` plus a timestamp. */
interface BaseWsEvent {
  /** ISO 8601 timestamp of when the event was produced. */
  timestamp: string;
}

/** print-server -> print-client: a job's status has changed. */
export interface JobStatusChangedEvent extends BaseWsEvent {
  type: "job:status_changed";
  payload: {
    jobId: JobId;
    status: JobStatus;
    message?: string;
  };
}

/** print-server -> print-client: page-level progress while a job is PRINTING. */
export interface JobProgressEvent extends BaseWsEvent {
  type: "job:progress";
  payload: {
    jobId: JobId;
    pagesPrinted: number;
    totalPages: number;
  };
}

/** print-server -> print-client/print-agent: a printer's status has changed. */
export interface PrinterStatusChangedEvent extends BaseWsEvent {
  type: "printer:status_changed";
  payload: {
    printerId: PrinterId;
    status: PrinterStatus;
  };
}

/** print-agent -> print-server: a newly discovered printer. */
export interface PrinterDiscoveredEvent extends BaseWsEvent {
  type: "printer:discovered";
  payload: {
    printerId: PrinterId;
    agentId: AgentId;
  };
}

/** print-server -> print-client/print-agent: an agent's connectivity status has changed. */
export interface AgentStatusChangedEvent extends BaseWsEvent {
  type: "agent:status_changed";
  payload: {
    agentId: AgentId;
    status: AgentStatus;
  };
}

/** print-server -> print-client: a printer's queue has been reordered or changed length. */
export interface QueueUpdatedEvent extends BaseWsEvent {
  type: "queue:updated";
  payload: {
    printerId: PrinterId;
    queueLength: number;
  };
}

/** print-server -> print-agent: instructs the agent to start a specific job. */
export interface DispatchJobEvent extends BaseWsEvent {
  type: "agent:dispatch_job";
  payload: {
    jobId: JobId;
    printerId: PrinterId;
  };
}

/** print-server -> print-agent: instructs the agent to cancel a job in progress. */
export interface CancelJobEvent extends BaseWsEvent {
  type: "agent:cancel_job";
  payload: {
    jobId: JobId;
  };
}

/** Either direction: lightweight keep-alive ping. */
export interface PingEvent extends BaseWsEvent {
  type: "connection:ping";
}

/** Either direction: lightweight keep-alive pong. */
export interface PongEvent extends BaseWsEvent {
  type: "connection:pong";
}

/** Either direction: generic error notification over an open socket. */
export interface WsErrorEvent extends BaseWsEvent {
  type: "connection:error";
  payload: {
    error: AppError;
  };
}

/** Union of every event type that can travel over the shared WebSocket channels. */
export type WsEvent =
  | JobStatusChangedEvent
  | JobProgressEvent
  | PrinterStatusChangedEvent
  | PrinterDiscoveredEvent
  | AgentStatusChangedEvent
  | QueueUpdatedEvent
  | DispatchJobEvent
  | CancelJobEvent
  | PingEvent
  | PongEvent
  | WsErrorEvent;

/** All valid WebSocket event type discriminants, useful for runtime checks. */
export type WsEventType = WsEvent["type"];

/** Narrow a raw WsEvent to a specific variant by its `type` field. */
export function isWsEventType<T extends WsEventType>(
  event: WsEvent,
  type: T
): event is Extract<WsEvent, { type: T }> {
  return event.type === type;
}
