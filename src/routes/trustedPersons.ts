import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { requireVerified } from '../middleware/auth';
import { requirePremium } from '../middleware/premium';
import { prisma } from '../db/prisma';
import { trustedPersonSchema, trustedPersonUpdateSchema } from '../validation/schemas';

/**
 * Verwaltung der Vertrauenspersonen — PREMIUM-Funktion. Free-Nutzer erhalten
 * einen 402 mit Upgrade-Hinweis (requirePremium).
 */
export const trustedPersonsRouter = Router();

trustedPersonsRouter.use(requireVerified, requirePremium);

trustedPersonsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.trustedPerson.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ items });
  }),
);

trustedPersonsRouter.post(
  '/',
  validateBody(trustedPersonSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.trustedPerson.create({
      data: { ...req.body, userId: req.user!.id },
    });
    res.status(201).json({ item });
  }),
);

trustedPersonsRouter.patch(
  '/:id',
  validateBody(trustedPersonUpdateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.trustedPerson.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) throw new AppError(404, 'Vertrauensperson nicht gefunden.');
    const item = await prisma.trustedPerson.update({ where: { id: existing.id }, data: req.body });
    res.json({ item });
  }),
);

trustedPersonsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.trustedPerson.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) throw new AppError(404, 'Vertrauensperson nicht gefunden.');
    await prisma.trustedPerson.delete({ where: { id: existing.id } });
    res.json({ message: 'Vertrauensperson gelöscht.' });
  }),
);
