import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';
import { env } from '../config/env';

/**
 * Einheitliche Fehlerbehandlung. Fehlermeldungen sind nutzerseitig auf Deutsch;
 * interne Details werden nicht nach aussen gegeben.
 */
export class AppError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, options?: { code?: string; details?: unknown }) {
    super(message);
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

/** Wrapper, der Fehler aus async-Handlern an Express weiterreicht. */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => unknown>(
  fn: T,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Nicht gefunden.' });
    return;
  }
  res.status(404).send('Nicht gefunden.');
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Bitte überprüfen Sie Ihre Eingaben.',
      fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error('app_error', { status: err.status, message: err.message });
    }
    res.status(err.status).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  logger.error('unhandled_error', {
    message: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({
    error: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
    ...(env.isProd ? {} : { debug: err instanceof Error ? err.message : String(err) }),
  });
}
