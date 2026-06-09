import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { sensitiveLimiter } from '../middleware/rateLimit';
import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { updateAccountSchema, deleteAccountSchema } from '../validation/schemas';
import { getStatusForUser } from '../services/entitlement';
import { createAndSendVerification } from '../services/auth';
import { exportUserData, deleteAccount } from '../services/account';
import { destroySession } from '../lib/session-helpers';
import { recordSecurityEvent } from '../lib/logger';

export const accountRouter = Router();

accountRouter.use(requireAuth);

accountRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const entitlement = await getStatusForUser(req.user!.id);
    res.json({
      user: {
        id: req.user!.id,
        email: req.user!.email,
        name: req.user!.name,
        role: req.user!.role,
        emailVerified: Boolean(req.user!.emailVerifiedAt),
        twoFactorEnabled: req.user!.totpEnabled,
      },
      entitlement,
    });
  }),
);

accountRouter.patch(
  '/',
  validateBody(updateAccountSchema),
  asyncHandler(async (req, res) => {
    const { name, email, newPassword, currentPassword } = req.body as {
      name?: string | null;
      email?: string;
      newPassword?: string;
      currentPassword?: string;
    };
    const userId = req.user!.id;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const changingSensitive = Boolean(newPassword || (email && email !== user.email));
    if (changingSensitive) {
      if (!currentPassword || !(await verifyPassword(user.passwordHash, currentPassword))) {
        throw new AppError(401, 'Bitte bestätigen Sie die Änderung mit Ihrem aktuellen Passwort.');
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;

    if (email && email !== user.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) {
        throw new AppError(409, 'Diese E-Mail-Adresse wird bereits verwendet.');
      }
      data.email = email;
      // Neue Adresse muss erneut verifiziert werden.
      data.emailVerifiedAt = null;
    }

    if (newPassword) {
      data.passwordHash = await hashPassword(newPassword);
    }

    await prisma.user.update({ where: { id: userId }, data });

    if (data.email) {
      await createAndSendVerification(userId, email!);
      await recordSecurityEvent({ type: 'email_changed', userId, req });
    }
    if (newPassword) {
      await recordSecurityEvent({ type: 'password_changed', userId, req });
    }

    res.json({
      message: data.email
        ? 'Konto aktualisiert. Bitte bestätigen Sie Ihre neue E-Mail-Adresse über den zugesandten Link.'
        : 'Konto aktualisiert.',
    });
  }),
);

accountRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const data = await exportUserData(req.user!.id);
    await recordSecurityEvent({ type: 'data_exported', userId: req.user!.id, req });
    const filename = `diginachlass-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }),
);

accountRouter.delete(
  '/',
  sensitiveLimiter,
  validateBody(deleteAccountSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(user.passwordHash, req.body.password))) {
      throw new AppError(401, 'Passwort ist falsch.');
    }
    await deleteAccount(userId);
    await destroySession(req);
    res.clearCookie('dnl.sid');
    res.json({ message: 'Ihr Konto und alle zugehörigen Daten wurden gelöscht.' });
  }),
);
