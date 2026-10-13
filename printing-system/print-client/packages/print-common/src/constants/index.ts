import { ColorMode, DuplexMode, PaperSize, PaperType, PrintQuality } from "../enums";

/** Package version marker, kept in sync with package.json's "version" field. */
export const PRINT_COMMON_VERSION = "1.0.0";

/** Default values applied when a client omits optional print options. */
export const DEFAULT_PRINT_OPTIONS = {
  copies: 1,
  colorMode: ColorMode.COLOR,
  duplexMode: DuplexMode.SIMPLEX,
  paperSize: PaperSize.A4,
  paperType: PaperType.NORMAL,
  quality: PrintQuality.NORMAL,
} as const;

/** Job priority bounds, shared by validation and scheduling logic in each service. */
export const JOB_PRIORITY = {
  MIN: 0,
  MAX: 10,
  DEFAULT: 5,
} as const;

/** Retry policy defaults for failed jobs. */
export const RETRY_POLICY = {
  MAX_RETRIES: 3,
  BACKOFF_BASE_MS: 2000,
  BACKOFF_MULTIPLIER: 2,
} as const;

/** Heartbeat/timeout intervals for print-agent <-> print-server liveness checks. */
export const AGENT_HEARTBEAT = {
  INTERVAL_SECONDS: 15,
  /** Agent considered offline if no heartbeat is received within this window. */
  TIMEOUT_SECONDS: 45,
} as const;

/** Pagination defaults shared by every list endpoint. */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 200,
} as const;

/** Upper bound on document size accepted by print-server, in bytes (100 MB). */
export const MAX_DOCUMENT_SIZE_BYTES = 100 * 1024 * 1024;

/** MIME types print-server/print-agent are guaranteed to support. */
export const SUPPORTED_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "application/postscript",
  "image/png",
  "image/jpeg",
  "text/plain",
] as const;

/** Names of the WebSocket channels/rooms used across the system. */
export const WS_CHANNELS = {
  JOB_UPDATES: "job-updates",
  PRINTER_UPDATES: "printer-updates",
  AGENT_UPDATES: "agent-updates",
  AGENT_COMMANDS: "agent-commands",
} as const;

/** HTTP header names shared by every service for request tracing/auth. */
export const HTTP_HEADERS = {
  REQUEST_ID: "x-request-id",
  AGENT_ID: "x-agent-id",
  API_KEY: "x-api-key",
} as const;
