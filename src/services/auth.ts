import type { Request } from 'express';
import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { generateToken, hashToken } from '../lib/tokens';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/emails';
import { recordSecurityEvent } from '../lib/logger';
import { ensureEntitlement } from './entitlement';

/**
 * Authentifizierungs-Logik. Bewusst nicht-enumerierend: Registrierung und
 * Passwort-Reset liefern immer dieselbe generische Antwort, unabhängig davon,
 * ob die E-Mail existiert.
 */

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;
const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24 h
const RESET_TTL_MS = 1000 * 60 * 60; // 1 h

// Dummy-Hash für Timing-Angleich, falls kein Nutzer existiert.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$3Q1Z2k2nq8mQx9o3Yk2bqf3sJ7s0r3uVqXc8b5m0wYg';

export type LoginOutcome =
  | { kind: 'ok'; userId: string }
  | { kind: 'twoFactorRequired'; userId: string }
  | { kind: 'invalid' }
  | { kind: 'locked'; until: Date }
  | { kind: 'twoFactorInvalid'; userId: string };

export async function createAndSendVerification(userId: string, email: string): Promise<void> {
  const token = generateToken();
  await prisma.emailVerification.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    },
  });
  await sendVerificationEmail(email, token);
}

/** Registrierung — immer generische Antwort (keine Enumeration). */
export async function registerUser(
  input: { email: string; password: string; name?: string },
  req: Request,
): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  if (existing) {
    // Konto existiert bereits — keine Preisgabe. Unverifizierte erhalten erneut
    // einen Verifizierungslink; verifizierte erhalten keinen neuen Account.
    if (!existing.emailVerifiedAt) {
      await createAndSendVerification(existing.id, existing.email);
    }
    await recordSecurityEvent({ type: 'register_existing_email', userId: existing.id, req });
    return;
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name ?? null,
    },
  });
  await ensureEntitlement(user.id);
  await createAndSendVerification(user.id, user.email);
  await recordSecurityEvent({ type: 'register', userId: user.id, req });
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  const record = await prisma.emailVerification.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    return false;
  }
  await prisma.$transaction([
    prisma.emailVerification.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);
  await recordSecurityEvent({ type: 'email_verified', userId: record.userId });
  return true;
}

export async function authenticate(
  input: { email: string; password: string; totp?: string },
  req: Request,
): Promise<LoginOutcome> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    // Timing angleichen, kein Nutzer-Leak.
    await verifyPassword(DUMMY_HASH, input.password);
    await recordSecurityEvent({ type: 'login_failed', req, meta: { reason: 'unknown_email' } });
    return { kind: 'invalid' };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordSecurityEvent({ type: 'login_locked', userId: user.id, req });
    return { kind: 'locked', until: user.lockedUntil };
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const lock = attempts >= LOCKOUT_THRESHOLD;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : user.lockedUntil,
      },
    });
    await recordSecurityEvent({
      type: 'login_failed',
      userId: user.id,
      req,
      meta: { attempts, locked: lock },
    });
    return lock
      ? { kind: 'locked', until: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) }
      : { kind: 'invalid' };
  }

  // Passwort korrekt — Zähler zurücksetzen.
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  // 2FA?
  if (user.totpEnabled) {
    if (!input.totp) {
      return { kind: 'twoFactorRequired', userId: user.id };
    }
    const { verifyUserTotp } = await import('./twoFactor');
    const ok = await verifyUserTotp(user.id, input.totp);
    if (!ok) {
      await recordSecurityEvent({ type: 'login_2fa_failed', userId: user.id, req });
      return { kind: 'twoFactorInvalid', userId: user.id };
    }
  }

  await recordSecurityEvent({ type: 'login_success', userId: user.id, req });
  return { kind: 'ok', userId: user.id };
}

/** Passwort-Reset anfordern — immer generische Antwort. */
export async function requestPasswordReset(email: string, req: Request): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await recordSecurityEvent({ type: 'password_reset_unknown', req });
    return;
  }
  const token = generateToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
  await sendPasswordResetEmail(user.email, token);
  await recordSecurityEvent({ type: 'password_reset_requested', userId: user.id, req });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<boolean> {
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    return false;
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
    // Alle übrigen offenen Reset-Tokens dieses Nutzers entwerten.
    prisma.passwordReset.updateMany({
      where: { userId: record.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
  ]);
  await recordSecurityEvent({ type: 'password_reset_completed', userId: record.userId });
  return true;
}
