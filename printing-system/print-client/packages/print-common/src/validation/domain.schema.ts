import { z } from "zod";
import { nonEmptyString, isoTimestamp, printerStatusSchema, connectionProtocolSchema, jobStatusSchema } from "./common.schema";
import { colorModeSchema, duplexModeSchema, paperSizeSchema, paperTypeSchema, printQualitySchema, agentStatusSchema } from "./common.schema";

export const printerCapabilitiesSchema = z.object({
  supportsColor: z.boolean(),
  supportsDuplex: z.boolean(),
  maxDpi: z.number().int().min(1),
  supportedPaperSizes: z.array(nonEmptyString).min(1),
  maxCopiesPerJob: z.number().int().min(1),
  maxDocumentSizeBytes: z.number().int().min(1),
});

export const printerConsumablesSchema = z.object({
  tonerOrInkPercent: z.number().min(0).max(100).optional(),
  paperTrayEmpty: z.boolean(),
});

export const printerSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  agentId: nonEmptyString,
  location: z.string().optional(),
  protocol: connectionProtocolSchema,
  status: printerStatusSchema,
  capabilities: printerCapabilitiesSchema,
  consumables: printerConsumablesSchema.optional(),
  lastSeenAt: isoTimestamp,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});

export const printerInfoSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  status: printerStatusSchema,
  location: z.string().optional(),
  capabilities: z.object({
    supportsColor: z.boolean(),
    supportsDuplex: z.boolean(),
    maxCopiesPerJob: z.number().int().min(1),
  }),
});

export const printOptionsSchema = z.object({
  copies: z.number().int().min(1).max(9999),
  colorMode: colorModeSchema,
  duplexMode: duplexModeSchema,
  paperSize: paperSizeSchema,
  paperType: paperTypeSchema,
  quality: printQualitySchema,
  pageRanges: z
    .string()
    .regex(/^\d+(-\d+)?(,\d+(-\d+)?)*$/, "must look like '1-5,8,11-13'")
    .optional(),
});

export const documentRefSchema = z.object({
  fileId: nonEmptyString,
  fileName: nonEmptyString.max(255),
  mimeType: nonEmptyString,
  sizeBytes: z.number().int().min(1),
  storageUri: nonEmptyString,
  pageCount: z.number().int().min(1).optional(),
});

export const jobStatusEventSchema = z.object({
  status: jobStatusSchema,
  occurredAt: isoTimestamp,
  message: z.string().max(1000).optional(),
});

export const printJobSchema = z.object({
  id: nonEmptyString,
  ownerId: nonEmptyString,
  printerId: nonEmptyString.optional(),
  agentId: nonEmptyString.optional(),
  document: documentRefSchema,
  options: printOptionsSchema,
  status: jobStatusSchema,
  history: z.array(jobStatusEventSchema),
  priority: z.number().int().min(0).max(10),
  retryCount: z.number().int().min(0),
  maxRetries: z.number().int().min(0),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});

export const queueItemSchema = z.object({
  jobId: nonEmptyString,
  printerId: nonEmptyString,
  priority: z.number().int().min(0).max(10),
  position: z.number().int().min(1),
  enqueuedAt: isoTimestamp,
});

export const agentInfoSchema = z.object({
  id: nonEmptyString,
  hostname: nonEmptyString,
  version: nonEmptyString,
  status: agentStatusSchema,
  managedPrinterIds: z.array(nonEmptyString),
  registeredAt: isoTimestamp,
  lastHeartbeatAt: isoTimestamp,
});
