import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireVerified } from '../middleware/auth';
import { requirePremium } from '../middleware/premium';
import { buildPreview, buildFull } from '../services/compendium';

/**
 * Compendium-Endpunkte. /preview ist kostenlos; das vollständige Compendium
 * (inkl. Risikoanalyse & Vollständigkeitsprüfung) ist Premium-gegated.
 */
export const compendiumRouter = Router();

compendiumRouter.get(
  '/preview',
  requireVerified,
  asyncHandler(async (req, res) => {
    res.json(await buildPreview(req.user!.id));
  }),
);

compendiumRouter.get(
  '/',
  requireVerified,
  requirePremium,
  asyncHandler(async (req, res) => {
    res.json(await buildFull(req.user!.id));
  }),
);
