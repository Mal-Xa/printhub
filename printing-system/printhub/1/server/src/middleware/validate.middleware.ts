import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type Target = 'body' | 'params' | 'query';

/**
 * Returns a middleware that validates `req[target]` against `schema`.
 * On success the parsed (coerced + stripped) value is written back to `req[target]`.
 * On failure a ZodError is forwarded to the error handler.
 */
export function validate(schema: ZodSchema, target: Target = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(result.error);
      return;
    }
    // Overwrite with parsed (coerced / stripped extra fields) value
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
}
