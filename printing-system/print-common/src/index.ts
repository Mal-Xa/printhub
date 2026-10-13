/**
 * print-common v1.0
 *
 * Source-of-truth shared TypeScript definitions for the distributed
 * printing system. Consumed by print-server, print-agent, and
 * print-client.
 *
 * Contains ONLY:
 *  - Shared interfaces (Printer, PrintJob, AgentInfo, ...)
 *  - Shared enums (JobStatus, PrinterStatus, AgentStatus, ...)
 *  - Shared constants
 *  - Shared API request/response models
 *  - Shared WebSocket event definitions
 *  - Shared printer capability models
 *  - Shared error models
 *  - Shared utility types
 *  - Zod validation schemas mirroring the above
 *
 * Contains NO application/business logic, no I/O, and no
 * service-specific dependencies.
 */

export * from "./enums";
export * from "./interfaces";
export * from "./api";
export * from "./errors";
export * from "./websocket";
export * from "./validation";
export * from "./constants";
export * from "./utils";
