import { z } from "zod";
import { nonEmptyString, isoTimestamp, errorCodeSchema } from "./common.schema";

export const errorDetailSchema = z.object({
  field: z.string().optional(),
  message: nonEmptyString,
});

export const appErrorSchema = z.object({
  code: errorCodeSchema,
  message: nonEmptyString,
  details: z.array(errorDetailSchema).optional(),
  timestamp: isoTimestamp,
  requestId: z.string().optional(),
});

export const apiErrorResponseSchema = z.object({
  error: appErrorSchema,
});
