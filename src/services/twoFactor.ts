import { prisma } from '../db/prisma';
import { encrypt, decrypt } from '../lib/crypto';
import { generateSecret, otpauthUrl, qrCodeDataUrl, verifyTotp } from '../lib/totp';
import { recordSecurityEvent } from '../lib/logger';

/**
 * TOTP-2FA-Verwaltung. Das Shared-Secret wird ausschliesslich verschlüsselt
 * gespeichert. 2FA gilt erst nach erfolgreicher Bestätigung (confirmedAt) als
 * aktiv.
 */

export interface TwoFactorSetup {
  secret: string; // Klartext nur einmalig für die Einrichtung
  otpauthUrl: string;
  qrDataUrl: string;
}

export async function startSetup(userId: string, email: string): Promise<TwoFactorSetup> {
  const secret = generateSecret();
  await prisma.totpSecret.upsert({
    where: { userId },
    create: { userId, secretEnc: encrypt(secret), confirmedAt: null },
    update: { secretEnc: encrypt(secret), confirmedAt: null },
  });
  const url = otpauthUrl(secret, email);
  const qr = await qrCodeDataUrl(url);
  return { secret, otpauthUrl: url, qrDataUrl: qr };
}

export async function confirmSetup(userId: string, token: string): Promise<boolean> {
  const record = await prisma.totpSecret.findUnique({ where: { userId } });
  if (!record) return false;
  const secret = decrypt(record.secretEnc);
  if (!verifyTotp(token, secret)) return false;

  await prisma.$transaction([
    prisma.totpSecret.update({ where: { userId }, data: { confirmedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } }),
  ]);
  await recordSecurityEvent({ type: '2fa_enabled', userId });
  return true;
}

export async function verifyUserTotp(userId: string, token: string): Promise<boolean> {
  const record = await prisma.totpSecret.findUnique({ where: { userId } });
  if (!record || !record.confirmedAt) return false;
  return verifyTotp(token, decrypt(record.secretEnc));
}

export async function disableTwoFactor(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.totpSecret.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { totpEnabled: false } }),
  ]);
  await recordSecurityEvent({ type: '2fa_disabled', userId });
}
