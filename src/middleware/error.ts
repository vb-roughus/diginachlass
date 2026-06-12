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

/**
 * Beschreibt einen unbekannten Fehler aussagekräftig fürs Log. Wichtig:
 * `AggregateError` (z. B. fehlgeschlagene DB-/SMTP-Verbindung über mehrere
 * Adressen — auf Windows lösen sich Hosts oft zu IPv6 *und* IPv4 auf) hat
 * häufig eine leere `message`; die eigentlichen Ursachen stecken in `.errors`.
 */
function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof AggregateError) {
    return {
      name: 'AggregateError',
      message: err.message || '(leer)',
      errors: err.errors.map((e) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e))),
      ...(env.isProd ? {} : { stack: err.stack }),
    };
  }
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    return {
      name: err.name,
      message: err.message || '(leer)',
      ...(code ? { code } : {}),
      ...(env.isProd ? {} : { stack: err.stack }),
    };
  }
  return { message: String(err) };
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  // Wurde bereits (teilweise) eine Antwort gesendet, darf kein zweites Mal
  // geschrieben werden — sonst ERR_HTTP_HEADERS_SENT. An Express' Standard-
  // Handler delegieren, der die Verbindung sauber schliesst.
  if (res.headersSent) {
    next(err);
    return;
  }

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

  const described = describeError(err);
  logger.error('unhandled_error', described);
  res.status(500).json({
    error: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
    ...(env.isProd ? {} : { debug: described }),
  });
}
