import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireVerified } from '../middleware/auth';
import { requirePremium } from '../middleware/premium';

/**
 * STUB — die eigentliche KI-Analyse ist NICHT Teil dieses Auftrags.
 * Der Endpunkt ist klar als Platzhalter gekennzeichnet und Premium-gegated, damit
 * die spätere Ausbaustufe nahtlos andocken kann.
 */
export const analysisRouter = Router();

analysisRouter.post(
  '/',
  requireVerified,
  requirePremium,
  asyncHandler(async (_req, res) => {
    res.status(501).json({
      status: 'nicht_implementiert',
      message:
        'Die KI-Analyse ist als nächste Ausbaustufe vorgesehen und in diesem Stand noch nicht aktiv.',
    });
  }),
);
