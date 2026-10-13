import type { NextFunction, Request, Response } from "express";

/**
 * Express always parses query-string values as strings (or arrays of
 * strings), but print-common's pagination/list schemas expect real
 * numbers for `page`/`pageSize` and an array for `status`. This
 * middleware normalizes `req.query` into that shape *before* it hits
 * `validate(...)`, so the shared Zod schemas can be used as-is
 * instead of duplicating query-parsing logic per route.
 */
export function normalizeListQuery(req: Request, _res: Response, next: NextFunction): void {
  const query = req.query as Record<string, unknown>;

  for (const field of ["page", "pageSize"]) {
    const value = query[field];
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        query[field] = parsed;
      }
    }
  }

  if (typeof query.status === "string") {
    query.status = [query.status];
  }

  next();
}
