import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../../../domain/errors";

type RequestPart = "body" | "query" | "params";

/**
 * Builds an Express middleware that parses `req[part]` against a Zod
 * schema (typically one from print-common's `validation` module) and
 * replaces it with the parsed/coerced value. Every API request in
 * this service is validated this way before reaching a controller.
 */
export function validate(schema: ZodSchema, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || undefined,
        message: issue.message,
      }));
      next(new ValidationError("Request validation failed", details));
      return;
    }
    (req as unknown as Record<RequestPart, unknown>)[part] = result.data;
    next();
  };
}
