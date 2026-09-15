import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { requireAdmin } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { recordSecurityEvent } from '../lib/logger';
import { ensureEntitlement } from '../services/entitlement';
import {
  catalogServiceSchema,
  catalogServiceUpdateSchema,
  compendiumEntrySchema,
} from '../validation/schemas';

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
      // Pflegestand des Kompendiums mitliefern, damit die Oberfläche ohne
      // zweite Abfrage weiss, wo noch Inhalte fehlen.
      include: { compendium: { select: { id: true } } },
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

// --- Kompendium -------------------------------------------------------------
// Je Katalog-Dienst genau ein Eintrag: Anlaufstelle, Schritte, offizielle Links
// und ein optionaler Hinweis.

adminRouter.get(
  '/compendium',
  asyncHandler(async (_req, res) => {
    const items = await prisma.compendiumEntry.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { service: { select: { id: true, name: true, category: true } } },
    });
    res.json({ items });
  }),
);

adminRouter.get(
  '/compendium/:serviceId',
  asyncHandler(async (req, res) => {
    const item = await prisma.compendiumEntry.findUnique({
      where: { serviceId: req.params.serviceId },
      include: { service: { select: { id: true, name: true, category: true } } },
    });
    if (!item) throw new AppError(404, 'Für diesen Dienst ist noch kein Eintrag erfasst.');
    res.json({ item });
  }),
);

// Anlegen oder aktualisieren — die Oberfläche muss beides nicht unterscheiden.
adminRouter.put(
  '/compendium/:serviceId',
  validateBody(compendiumEntrySchema),
  asyncHandler(async (req, res) => {
    const service = await prisma.catalogService.findUnique({ where: { id: req.params.serviceId } });
    if (!service) throw new AppError(404, 'Dienst nicht gefunden.');

    const data = {
      contactPoint: req.body.contactPoint,
      steps: req.body.steps,
      links: req.body.links,
      note: req.body.note ?? null,
    };
    const item = await prisma.compendiumEntry.upsert({
      where: { serviceId: service.id },
      create: { serviceId: service.id, ...data },
      update: data,
    });
    res.json({ item });
  }),
);

adminRouter.delete(
  '/compendium/:serviceId',
  asyncHandler(async (req, res) => {
    const existing = await prisma.compendiumEntry.findUnique({
      where: { serviceId: req.params.serviceId },
    });
    if (!existing) throw new AppError(404, 'Für diesen Dienst ist kein Eintrag erfasst.');
    await prisma.compendiumEntry.delete({ where: { serviceId: req.params.serviceId } });
    res.status(204).end();
  }),
);

// --- Entitlement zurücksetzen ------------------------------------------------
// Für Support- und Testfälle: setzt ein Konto auf "free" zurück. Der Stripe-
// Kunde bleibt erhalten, damit spätere Käufe demselben Kunden zugeordnet werden.
adminRouter.post(
  '/users/:id/entitlement/reset',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true },
    });
    if (!user) throw new AppError(404, 'Nutzer nicht gefunden.');

    await ensureEntitlement(user.id);
    const entitlement = await prisma.entitlement.update({
      where: { userId: user.id },
      data: {
        plan: 'free',
        type: null,
        status: 'none',
        validUntil: null,
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
        stripePaymentIntentId: null,
      },
    });

    await recordSecurityEvent({
      type: 'entitlement_reset_by_admin',
      userId: user.id,
      req,
      meta: { by: req.user!.id, email: user.email },
    });

    res.json({ entitlement });
  }),
);
