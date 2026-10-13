import { ErrorCode } from "../enums";

/** Structured error detail, e.g. a single field validation failure. */
export interface ErrorDetail {
  field?: string;
  message: string;
}

/**
 * Canonical shape of an error, whether it travels inside an HTTP
 * response body or is thrown as an exception payload internally.
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
  /** ISO 8601 timestamp of when the error occurred. */
  timestamp: string;
  /** Correlation id for tracing the request across services. */
  requestId?: string;
}

/** Standard HTTP error response envelope returned by print-server. */
export interface ApiErrorResponse {
  error: AppError;
}
