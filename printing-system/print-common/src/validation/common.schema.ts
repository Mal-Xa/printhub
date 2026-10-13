import { z } from "zod";
import {
  JobStatus,
  PrinterStatus,
  AgentStatus,
  ColorMode,
  DuplexMode,
  PaperSize,
  PaperType,
  PrintQuality,
  ConnectionProtocol,
  ErrorCode,
} from "../enums";

export const nonEmptyString = z.string().trim().min(1);
export const isoTimestamp = z.string().datetime();

export const jobStatusSchema = z.nativeEnum(JobStatus);
export const printerStatusSchema = z.nativeEnum(PrinterStatus);
export const agentStatusSchema = z.nativeEnum(AgentStatus);
export const colorModeSchema = z.nativeEnum(ColorMode);
export const duplexModeSchema = z.nativeEnum(DuplexMode);
export const paperSizeSchema = z.nativeEnum(PaperSize);
export const paperTypeSchema = z.nativeEnum(PaperType);
export const printQualitySchema = z.nativeEnum(PrintQuality);
export const connectionProtocolSchema = z.nativeEnum(ConnectionProtocol);
export const errorCodeSchema = z.nativeEnum(ErrorCode);

export const paginationParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(25),
});

export const sortParamSchema = z.object({
  field: nonEmptyString,
  direction: z.enum(["asc", "desc"]),
});
