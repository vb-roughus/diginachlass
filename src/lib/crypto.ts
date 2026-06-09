import crypto from 'node:crypto';
import { env } from '../config/env';

/**
 * Anwendungsseitige Verschlüsselung sensibler Kleindaten (z. B. TOTP-Secrets)
 * mit AES-256-GCM — Defense-in-Depth zusätzlich zur Verschlüsselung at rest
 * auf DB-/Festplattenebene.
 */

// 32-Byte-Schlüssel deterministisch aus ENCRYPTION_KEY ableiten.
const KEY = crypto.createHash('sha256').update(env.ENCRYPTION_KEY, 'utf8').digest();

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Ungültiges verschlüsseltes Format');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
