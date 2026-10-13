import { ErrorCode, type ErrorDetail } from "print-common";

/**
 * Base class for every error raised by the domain/application layers.
 * Carries an `ErrorCode` from print-common so the HTTP layer can turn
 * it into a canonical `ApiErrorResponse` without re-deriving meaning
 * from the error message or a stack trace.
 */
export class DomainError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, message: string, httpStatus: number, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(ErrorCode.NOT_FOUND, `${resource} '${id}' was not found`, 404);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(ErrorCode.CONFLICT, message, 409);
  }
}

export class PrinterUnavailableError extends DomainError {
  constructor(printerId: string) {
    super(ErrorCode.PRINTER_UNAVAILABLE, `Printer '${printerId}' is not available to accept jobs`, 409);
  }
}

export class AgentUnreachableError extends DomainError {
  constructor(agentId: string) {
    super(ErrorCode.AGENT_UNREACHABLE, `Agent '${agentId}' is not currently connected`, 503);
  }
}

export class JobNotCancellableError extends DomainError {
  constructor(jobId: string, status: string) {
    super(
      ErrorCode.JOB_NOT_CANCELLABLE,
      `Job '${jobId}' cannot be cancelled while in status '${status}'`,
      409
    );
  }
}

export class UploadTooLargeError extends DomainError {
  constructor(sizeBytes: number, maxBytes: number) {
    super(
      ErrorCode.UPLOAD_TOO_LARGE,
      `Upload of ${sizeBytes} bytes exceeds the maximum allowed size of ${maxBytes} bytes`,
      413
    );
  }
}

export class UnsupportedFileTypeError extends DomainError {
  constructor(mimeType: string) {
    super(ErrorCode.UNSUPPORTED_FILE_TYPE, `File type '${mimeType}' is not supported`, 415);
  }
}
