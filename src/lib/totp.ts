import { authenticator } from 'otplib';
import QRCode from 'qrcode';

/**
 * TOTP-2FA (RFC 6238) via Authenticator-App. Das Shared-Secret wird vom Aufrufer
 * verschlüsselt gespeichert (siehe lib/crypto.ts), niemals im Klartext persistiert.
 */

// Etwas Toleranz gegen Zeitdrift der Client-Uhr.
authenticator.options = { window: 1 };

const ISSUER = 'diginachlass.ch';

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function otpauthUrl(secret: string, accountEmail: string): string {
  return authenticator.keyuri(accountEmail, ISSUER, secret);
}

export async function qrCodeDataUrl(otpauth: string): Promise<string> {
  return QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s+/g, ''), secret });
  } catch {
    return false;
  }
}
