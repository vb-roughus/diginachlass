import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Validiert req.body gegen ein zod-Schema und ersetzt den Body durch die
 * geparsten/typisierten Daten. Fehler werden vom zentralen Error-Handler
 * (ZodError) übersetzt.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}
