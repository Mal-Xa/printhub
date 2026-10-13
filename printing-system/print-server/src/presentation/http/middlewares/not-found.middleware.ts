import type { NextFunction, Request, Response } from "express";
import { ErrorCode, type ApiErrorResponse } from "print-common";

/** Handles any request that didn't match a route, returning a canonical NOT_FOUND error body. */
export function notFoundMiddleware(req: Request, res: Response, _next: NextFunction): void {
  const body: ApiErrorResponse = {
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `No route matches ${req.method} ${req.path}`,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    },
  };
  res.status(404).json(body);
}
