import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireVerified } from '../middleware/auth';
import { requirePremium } from '../middleware/premium';
import { buildPreview, buildFull } from '../services/compendium';
import { generateWhitepaper } from '../services/whitepaper';

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

// White Paper (PDF) — Premium: Risikoübersicht + Anlaufstellen zur Nachlasshandhabung.
compendiumRouter.get(
  '/whitepaper.pdf',
  requireVerified,
  requirePremium,
  asyncHandler(async (req, res) => {
    const full = await buildFull(req.user!.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="diginachlass-white-paper.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    generateWhitepaper(res, {
      userName: req.user!.name,
      date: new Date(),
      compendium: full,
    });
  }),
);
