import { z } from "zod";
import { nonEmptyString, isoTimestamp, paginationParamsSchema, sortParamSchema } from "./common.schema";
import { colorModeSchema, duplexModeSchema, paperSizeSchema, paperTypeSchema, printQualitySchema, connectionProtocolSchema } from "./common.schema";
import { printOptionsSchema, printerCapabilitiesSchema } from "./domain.schema";

export const uploadRequestSchema = z.object({
  ownerId: nonEmptyString,
  fileName: nonEmptyString.max(255),
  mimeType: nonEmptyString,
  sizeBytes: z.number().int().min(1),
});

export const printRequestSchema = z.object({
  ownerId: nonEmptyString,
  fileId: nonEmptyString,
  printerId: nonEmptyString.optional(),
  options: z.object({
    copies: z.number().int().min(1).max(9999),
    colorMode: colorModeSchema,
    duplexMode: duplexModeSchema,
    paperSize: paperSizeSchema,
    paperType: paperTypeSchema,
    quality: printQualitySchema,
    pageRanges: printOptionsSchema.shape.pageRanges,
  }),
  priority: z.number().int().min(0).max(10).optional(),
});

export const cancelJobRequestSchema = z.object({
  jobId: nonEmptyString,
  reason: z.string().max(500).optional(),
});

export const listJobsRequestSchema = paginationParamsSchema.extend({
  ownerId: nonEmptyString.optional(),
  printerId: nonEmptyString.optional(),
  status: z.array(nonEmptyString).optional(),
  sort: sortParamSchema.optional(),
});

export const listPrintersRequestSchema = paginationParamsSchema.extend({
  status: z.array(nonEmptyString).optional(),
  agentId: nonEmptyString.optional(),
});

export const agentRegistrationRequestSchema = z.object({
  hostname: nonEmptyString,
  version: nonEmptyString,
  printers: z
    .array(
      z.object({
        name: nonEmptyString,
        protocol: connectionProtocolSchema,
        capabilities: printerCapabilitiesSchema,
      })
    )
    .min(1),
});

export const heartbeatRequestSchema = z.object({
  agentId: nonEmptyString,
  sentAt: isoTimestamp,
  printerStatuses: z
    .array(
      z.object({
        printerId: nonEmptyString,
        status: nonEmptyString,
      })
    )
    .optional(),
});

/** Convenience map for looking up a request schema by logical name, e.g. in shared middleware. */
export const requestSchemas = {
  upload: uploadRequestSchema,
  print: printRequestSchema,
  cancelJob: cancelJobRequestSchema,
  listJobs: listJobsRequestSchema,
  listPrinters: listPrintersRequestSchema,
  agentRegistration: agentRegistrationRequestSchema,
  heartbeat: heartbeatRequestSchema,
} as const;

export type UploadRequestParsed = z.infer<typeof uploadRequestSchema>;
export type PrintRequestParsed = z.infer<typeof printRequestSchema>;
export type CancelJobRequestParsed = z.infer<typeof cancelJobRequestSchema>;
export type ListJobsRequestParsed = z.infer<typeof listJobsRequestSchema>;
export type ListPrintersRequestParsed = z.infer<typeof listPrintersRequestSchema>;
export type AgentRegistrationRequestParsed = z.infer<typeof agentRegistrationRequestSchema>;
export type HeartbeatRequestParsed = z.infer<typeof heartbeatRequestSchema>;
