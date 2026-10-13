import { z } from "zod";
import { nonEmptyString, isoTimestamp, jobStatusSchema, printerStatusSchema, agentStatusSchema } from "./common.schema";
import { appErrorSchema } from "./error.schema";

const baseWsEventSchema = z.object({
  timestamp: isoTimestamp,
});

export const jobStatusChangedEventSchema = baseWsEventSchema.extend({
  type: z.literal("job:status_changed"),
  payload: z.object({
    jobId: nonEmptyString,
    status: jobStatusSchema,
    message: z.string().optional(),
  }),
});

export const jobProgressEventSchema = baseWsEventSchema.extend({
  type: z.literal("job:progress"),
  payload: z.object({
    jobId: nonEmptyString,
    pagesPrinted: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export const printerStatusChangedEventSchema = baseWsEventSchema.extend({
  type: z.literal("printer:status_changed"),
  payload: z.object({
    printerId: nonEmptyString,
    status: printerStatusSchema,
  }),
});

export const printerDiscoveredEventSchema = baseWsEventSchema.extend({
  type: z.literal("printer:discovered"),
  payload: z.object({
    printerId: nonEmptyString,
    agentId: nonEmptyString,
  }),
});

export const agentStatusChangedEventSchema = baseWsEventSchema.extend({
  type: z.literal("agent:status_changed"),
  payload: z.object({
    agentId: nonEmptyString,
    status: agentStatusSchema,
  }),
});

export const queueUpdatedEventSchema = baseWsEventSchema.extend({
  type: z.literal("queue:updated"),
  payload: z.object({
    printerId: nonEmptyString,
    queueLength: z.number().int().min(0),
  }),
});

export const dispatchJobEventSchema = baseWsEventSchema.extend({
  type: z.literal("agent:dispatch_job"),
  payload: z.object({
    jobId: nonEmptyString,
    printerId: nonEmptyString,
  }),
});

export const cancelJobEventSchema = baseWsEventSchema.extend({
  type: z.literal("agent:cancel_job"),
  payload: z.object({
    jobId: nonEmptyString,
  }),
});

export const pingEventSchema = baseWsEventSchema.extend({
  type: z.literal("connection:ping"),
});

export const pongEventSchema = baseWsEventSchema.extend({
  type: z.literal("connection:pong"),
});

export const wsErrorEventSchema = baseWsEventSchema.extend({
  type: z.literal("connection:error"),
  payload: z.object({
    error: appErrorSchema,
  }),
});

/** Discriminated-union schema matching the WsEvent type; parses any valid event. */
export const wsEventSchema = z.discriminatedUnion("type", [
  jobStatusChangedEventSchema,
  jobProgressEventSchema,
  printerStatusChangedEventSchema,
  printerDiscoveredEventSchema,
  agentStatusChangedEventSchema,
  queueUpdatedEventSchema,
  dispatchJobEventSchema,
  cancelJobEventSchema,
  pingEventSchema,
  pongEventSchema,
  wsErrorEventSchema,
]);
