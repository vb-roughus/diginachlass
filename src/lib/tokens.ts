import crypto from 'node:crypto';

/**
 * Opake Tokens für E-Mail-Verifizierung und Passwort-Reset.
 * Es wird IMMER nur der SHA-256-Hash in der DB gespeichert; das Klartext-Token
 * geht ausschliesslich per E-Mail an den Nutzer.
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Konstantzeit-Vergleich (gegen Timing-Angriffe). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
