import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { authLimiter, sensitiveLimiter } from '../middleware/rateLimit';
import { loginSession, destroySession } from '../lib/session-helpers';
import { verifyPassword } from '../lib/password';
import { prisma } from '../db/prisma';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  twoFactorVerifySchema,
} from '../validation/schemas';
import {
  registerUser,
  verifyEmailToken,
  authenticate,
  requestPasswordReset,
  confirmPasswordReset,
} from '../services/auth';
import { startSetup, confirmSetup, disableTwoFactor } from '../services/twoFactor';

export const authRouter = Router();

const GENERIC_REGISTER_MSG =
  'Falls die Adresse verwendet werden kann, haben wir Ihnen eine E-Mail geschickt. Bitte prüfen Sie Ihr Postfach.';
const GENERIC_RESET_MSG =
  'Falls ein Konto zu dieser Adresse existiert, haben wir Ihnen eine E-Mail zum Zurücksetzen geschickt.';

authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    await registerUser(req.body, req);
    // Bewusst nicht-enumerierend: immer dieselbe Antwort.
    res.status(200).json({ message: GENERIC_REGISTER_MSG });
  }),
);

authRouter.post(
  '/verify-email',
  validateBody(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    const ok = await verifyEmailToken(req.body.token);
    if (!ok) {
      throw new AppError(400, 'Der Bestätigungslink ist ungültig oder abgelaufen.');
    }
    res.json({ message: 'Ihre E-Mail-Adresse wurde bestätigt. Sie können sich jetzt anmelden.' });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const outcome = await authenticate(req.body, req);
    switch (outcome.kind) {
      case 'ok':
        await loginSession(req, outcome.userId);
        res.json({ message: 'Anmeldung erfolgreich.' });
        return;
      case 'twoFactorRequired':
        res.status(200).json({
          twoFactorRequired: true,
          message: 'Bitte geben Sie Ihren Bestätigungscode (2FA) ein.',
        });
        return;
      case 'twoFactorInvalid':
        throw new AppError(401, 'Der 2FA-Code ist ungültig.', { code: '2FA_UNGUELTIG' });
      case 'locked':
        throw new AppError(
          429,
          'Zu viele Fehlversuche. Ihr Konto ist vorübergehend gesperrt. Bitte versuchen Sie es in einigen Minuten erneut.',
          { code: 'GESPERRT' },
        );
      case 'invalid':
      default:
        throw new AppError(401, 'E-Mail oder Passwort ist falsch.', { code: 'UNGUELTIG' });
    }
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await destroySession(req);
    res.clearCookie('dnl.sid');
    res.json({ message: 'Sie wurden abgemeldet.' });
  }),
);

authRouter.post(
  '/password-reset/request',
  sensitiveLimiter,
  validateBody(passwordResetRequestSchema),
  asyncHandler(async (req, res) => {
    await requestPasswordReset(req.body.email, req);
    res.json({ message: GENERIC_RESET_MSG });
  }),
);

authRouter.post(
  '/password-reset/confirm',
  authLimiter,
  validateBody(passwordResetConfirmSchema),
  asyncHandler(async (req, res) => {
    const ok = await confirmPasswordReset(req.body.token, req.body.password);
    if (!ok) {
      throw new AppError(400, 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.');
    }
    res.json({ message: 'Ihr Passwort wurde geändert. Sie können sich jetzt anmelden.' });
  }),
);

// --- 2FA (TOTP) --------------------------------------------------------------

authRouter.post(
  '/2fa/setup',
  requireAuth,
  asyncHandler(async (req, res) => {
    const setup = await startSetup(req.user!.id, req.user!.email);
    res.json({
      message: 'Scannen Sie den QR-Code mit Ihrer Authenticator-App und bestätigen Sie mit dem Code.',
      qrDataUrl: setup.qrDataUrl,
      secret: setup.secret,
      otpauthUrl: setup.otpauthUrl,
    });
  }),
);

authRouter.post(
  '/2fa/verify',
  requireAuth,
  validateBody(twoFactorVerifySchema),
  asyncHandler(async (req, res) => {
    const ok = await confirmSetup(req.user!.id, req.body.token);
    if (!ok) {
      throw new AppError(400, 'Der Code ist ungültig. Bitte versuchen Sie es erneut.');
    }
    res.json({ message: 'Zwei-Faktor-Authentifizierung wurde aktiviert.' });
  }),
);

authRouter.post(
  '/2fa/disable',
  requireAuth,
  sensitiveLimiter,
  asyncHandler(async (req, res) => {
    const password = String(req.body?.password ?? '');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new AppError(401, 'Passwort ist falsch.');
    }
    await disableTwoFactor(req.user!.id);
    res.json({ message: 'Zwei-Faktor-Authentifizierung wurde deaktiviert.' });
  }),
);
