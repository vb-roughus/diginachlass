import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireAdmin } from '../middleware/auth';
import { prisma } from '../db/prisma';

/**
 * Admin-Endpunkte. Ersetzt das frühere Prototyp-Passcode-Gate (1234) durch eine
 * echte, rollenbasierte Autorisierung (requireAdmin).
 */
export const adminRouter = Router();

adminRouter.use(requireAdmin);

// Vom Frontend (Admin-Panel der Landingpage) genutzt, um Admin-Rechte zu prüfen.
adminRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json({ admin: true, email: req.user!.email });
  }),
);

// Schlanke Nutzerübersicht für Administratoren.
adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
        entitlement: { select: { plan: true, type: true, status: true } },
      },
    });
    res.json({ users });
  }),
);
