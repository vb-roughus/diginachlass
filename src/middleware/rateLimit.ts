import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Rate-Limiting gegen Brute-Force/Missbrauch. In Tests deaktiviert, damit die
 * Test-Suite nicht künstlich gedrosselt wird.
 */
const disabled = env.isTest;

const noop = (_req: unknown, _res: unknown, next: () => void) => next();

function makeLimiter(opts: { windowMs: number; max: number; message: string }) {
  if (disabled) return noop as unknown as ReturnType<typeof rateLimit>;
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: opts.message },
  });
}

// Allgemeines API-Limit
export const apiLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.',
});

// Strenger für sicherheitsrelevante Auth-Endpunkte
export const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Zu viele Versuche. Bitte warten Sie einige Minuten.',
});

// Sehr streng für teure/missbrauchbare Aktionen (Mailversand)
export const sensitiveLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Zu viele Anfragen. Bitte versuchen Sie es in einer Stunde erneut.',
});
