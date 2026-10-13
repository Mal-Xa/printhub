/**
 * Canonical error codes returned by print-server and interpreted by
 * print-agent and print-client. Kept here so all services agree on
 * meaning without duplicating string literals.
 */
export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  CONFLICT = "CONFLICT",
  PRINTER_UNAVAILABLE = "PRINTER_UNAVAILABLE",
  AGENT_UNREACHABLE = "AGENT_UNREACHABLE",
  JOB_NOT_CANCELLABLE = "JOB_NOT_CANCELLABLE",
  UPLOAD_TOO_LARGE = "UPLOAD_TOO_LARGE",
  UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
