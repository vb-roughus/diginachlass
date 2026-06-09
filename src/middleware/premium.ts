import type { NextFunction, Request, Response } from 'express';
import { AppError, asyncHandler } from './error';
import { hasActivePremium } from '../services/entitlement';

/**
 * Premium-Gating, serverseitig durchgesetzt. Free-Nutzer erhalten einen sauberen
 * 402-Fehler mit Upgrade-Hinweis. (402 Payment Required — passend für das
 * Freemium-Gating.)
 */
export const requirePremium = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, 'Bitte melden Sie sich an.', { code: 'NICHT_ANGEMELDET' });
    }
    const premium = await hasActivePremium(req.user.id);
    if (!premium) {
      throw new AppError(402, 'Diese Funktion ist Teil von Premium. Bitte schalten Sie Premium frei.', {
        code: 'PREMIUM_ERFORDERLICH',
        details: { upgradeUrl: '/app/upgrade.html' },
      });
    }
    next();
  },
);
