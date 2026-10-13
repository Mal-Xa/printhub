import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { HTTP_HEADERS } from "print-common";

/** Assigns (or forwards) a correlation id for every request, echoed back in the response header. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HTTP_HEADERS.REQUEST_ID);
  req.requestId = incoming && incoming.trim().length > 0 ? incoming : randomUUID();
  res.setHeader(HTTP_HEADERS.REQUEST_ID, req.requestId);
  next();
}
