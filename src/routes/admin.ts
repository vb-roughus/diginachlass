import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { requireAdmin } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { catalogServiceSchema, catalogServiceUpdateSchema } from '../validation/schemas';

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

// --- Dienst-Katalog ---------------------------------------------------------
// Pflege der Auswahlliste, die Nutzenden bei der Erfassung angeboten wird.

/** Prisma meldet eine verletzte Unique-Bedingung mit dem Code P2002. */
function isDuplicateName(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

adminRouter.get(
  '/services',
  asyncHandler(async (_req, res) => {
    // Bewusst inklusive inaktiver Einträge — der Admin soll alles sehen.
    const items = await prisma.catalogService.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ items });
  }),
);

adminRouter.post(
  '/services',
  validateBody(catalogServiceSchema),
  asyncHandler(async (req, res) => {
    try {
      const item = await prisma.catalogService.create({ data: req.body });
      res.status(201).json({ item });
    } catch (err) {
      if (isDuplicateName(err)) {
        throw new AppError(409, 'Ein Dienst mit diesem Namen existiert bereits.', {
          code: 'DIENST_EXISTIERT',
        });
      }
      throw err;
    }
  }),
);

adminRouter.patch(
  '/services/:id',
  validateBody(catalogServiceUpdateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.catalogService.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Dienst nicht gefunden.');
    try {
      const item = await prisma.catalogService.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json({ item });
    } catch (err) {
      if (isDuplicateName(err)) {
        throw new AppError(409, 'Ein Dienst mit diesem Namen existiert bereits.', {
          code: 'DIENST_EXISTIERT',
        });
      }
      throw err;
    }
  }),
);

adminRouter.delete(
  '/services/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.catalogService.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Dienst nicht gefunden.');
    await prisma.catalogService.delete({ where: { id: req.params.id } });
    // Bereits erfasste Nutzer-Dienste bleiben unberührt: sie speichern den Namen
    // als Text und haben keine Fremdschlüssel-Beziehung zum Katalog.
    res.status(204).end();
  }),
);
