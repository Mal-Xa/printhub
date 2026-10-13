import { JobId, PrinterId, AgentId, UserId, FileId } from "./types";

/**
 * These helpers perform a compile-time-only cast into a branded ID type.
 * They do not validate, transform, or generate values — actual ID
 * generation and validation live in the consuming services.
 */
export const asJobId = (value: string): JobId => value as JobId;
export const asPrinterId = (value: string): PrinterId => value as PrinterId;
export const asAgentId = (value: string): AgentId => value as AgentId;
export const asUserId = (value: string): UserId => value as UserId;
export const asFileId = (value: string): FileId => value as FileId;
