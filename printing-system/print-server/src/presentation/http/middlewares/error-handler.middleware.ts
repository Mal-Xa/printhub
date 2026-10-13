import type { NextFunction, Request, Response } from "express";
import { ErrorCode, type ApiErrorResponse } from "print-common";
import { DomainError } from "../../../domain/errors";
import type { Logger } from "../../../infrastructure/logging/logger";

interface ZodIssueLike {
  path: Array<string | number>;
  message: string;
}

interface ZodErrorLike {
  name: "ZodError";
  issues: ZodIssueLike[];
}

/**
 * Structural check for a Zod validation error. print-common and
 * print-server each declare their own `zod` dependency; depending on
 * how the workspace is installed, npm may not dedupe them into a
 * single copy, in which case `err instanceof ZodError` fails even for
 * a genuine Zod error (two different classes, same shape). Checking
 * the error's shape instead of its prototype chain works regardless.
 */
function isZodErrorLike(err: unknown): err is ZodErrorLike {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

/**
 * Converts any error thrown/forwarded within the HTTP layer into the
 * canonical `ApiErrorResponse` shape from print-common, and picks the
 * appropriate HTTP status code. Must be registered last, after all
 * routes.
 */
export function errorHandler(logger: Logger) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const timestamp = new Date().toISOString();

    if (err instanceof DomainError) {
      const body: ApiErrorResponse = {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          timestamp,
          requestId: req.requestId,
        },
      };
      if (err.httpStatus >= 500) {
        logger.error({ err, requestId: req.requestId }, "Request failed with server error");
      } else {
        logger.warn({ code: err.code, requestId: req.requestId }, err.message);
      }
      res.status(err.httpStatus).json(body);
      return;
    }

    if (isZodErrorLike(err)) {
      const body: ApiErrorResponse = {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "Request validation failed",
          details: err.issues.map((issue) => ({
            field: issue.path.join(".") || undefined,
            message: issue.message,
          })),
          timestamp,
          requestId: req.requestId,
        },
      };
      res.status(400).json(body);
      return;
    }

    logger.error({ err, requestId: req.requestId }, "Unhandled error");
    const body: ApiErrorResponse = {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred",
        timestamp,
        requestId: req.requestId,
      },
    };
    res.status(500).json(body);
  };
}
