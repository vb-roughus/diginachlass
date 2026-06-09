import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { AppError, asyncHandler } from './error';

/**
 * Lädt den Nutzer anhand der Session und hängt ihn an req.user. Räumt verwaiste
 * Sessions (Nutzer gelöscht) auf. Wird global vor den Routen registriert.
 */
export const loadUser = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const userId = req.session.userId;
  if (!userId) return next();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerifiedAt: true,
      totpEnabled: true,
    },
  });

  if (!user) {
    req.session.destroy(() => undefined);
    return next();
  }

  req.user = user;
  next();
});

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AppError(401, 'Bitte melden Sie sich an.', { code: 'NICHT_ANGEMELDET' });
  }
  next();
}

export function requireVerified(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AppError(401, 'Bitte melden Sie sich an.', { code: 'NICHT_ANGEMELDET' });
  }
  if (!req.user.emailVerifiedAt) {
    throw new AppError(403, 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.', {
      code: 'EMAIL_NICHT_VERIFIZIERT',
    });
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AppError(401, 'Bitte melden Sie sich an.', { code: 'NICHT_ANGEMELDET' });
  }
  if (req.user.role !== 'admin') {
    throw new AppError(403, 'Kein Zugriff. Diese Funktion ist Administratoren vorbehalten.', {
      code: 'KEIN_ADMIN',
    });
  }
  next();
}
