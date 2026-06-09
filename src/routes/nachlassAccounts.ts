import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { requireVerified } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { nachlassAccountSchema, nachlassAccountUpdateSchema } from '../validation/schemas';

/**
 * CRUD für Nachlass-Dienste (Metadaten). Verfügbar für verifizierte Nutzer
 * (auch Free). SCOPE-REGEL: ausschliesslich Metadaten — kein Feld für Geheimnisse.
 */
export const nachlassAccountsRouter = Router();

nachlassAccountsRouter.use(requireVerified);

nachlassAccountsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.nachlassAccount.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ items });
  }),
);

nachlassAccountsRouter.post(
  '/',
  validateBody(nachlassAccountSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.nachlassAccount.create({
      data: { ...req.body, userId: req.user!.id },
    });
    res.status(201).json({ item });
  }),
);

nachlassAccountsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.nachlassAccount.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!item) throw new AppError(404, 'Dienst nicht gefunden.');
    res.json({ item });
  }),
);

nachlassAccountsRouter.patch(
  '/:id',
  validateBody(nachlassAccountUpdateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.nachlassAccount.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) throw new AppError(404, 'Dienst nicht gefunden.');
    const item = await prisma.nachlassAccount.update({
      where: { id: existing.id },
      data: req.body,
    });
    res.json({ item });
  }),
);

nachlassAccountsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.nachlassAccount.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) throw new AppError(404, 'Dienst nicht gefunden.');
    await prisma.nachlassAccount.delete({ where: { id: existing.id } });
    res.json({ message: 'Dienst gelöscht.' });
  }),
);
