import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireVerified } from '../middleware/auth';
import { prisma } from '../db/prisma';

/**
 * Vom Administrator gepflegter Dienst-Katalog — die Auswahlliste, die Nutzenden
 * bei der Erfassung vorgeschlagen wird. Hier ausschliesslich lesend und nur
 * aktive Einträge; gepflegt wird der Katalog über /api/admin/services.
 */
export const servicesRouter = Router();

servicesRouter.use(requireVerified);

servicesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await prisma.catalogService.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, category: true, provider: true },
    });
    res.json({ items });
  }),
);
