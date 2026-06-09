import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from './error';
import { safeEqual } from '../lib/tokens';

/**
 * CSRF-Schutz per Synchronizer-Token. Das Token liegt in der serverseitigen
 * Session und muss bei zustandsändernden Requests im Header `x-csrf-token`
 * mitgeschickt werden. Sichere Methoden (GET/HEAD/OPTIONS) sind ausgenommen.
 *
 * Die Stripe-Webhook-Route ist NICHT durch CSRF geschützt (kein Cookie/Session,
 * stattdessen Signaturprüfung mit Raw-Body) und wird vor dieser Middleware
 * gemountet.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function ensureCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('base64url');
  }
  return req.session.csrfToken;
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  // Token sicherstellen, damit GET /api/csrf immer einen Wert liefern kann.
  ensureCsrfToken(req);

  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const headerToken = req.get('x-csrf-token') ?? '';
  const sessionToken = req.session.csrfToken ?? '';

  if (!headerToken || !sessionToken || !safeEqual(headerToken, sessionToken)) {
    throw new AppError(403, 'Ungültiges oder fehlendes CSRF-Token. Bitte laden Sie die Seite neu.', {
      code: 'CSRF',
    });
  }

  next();
}
