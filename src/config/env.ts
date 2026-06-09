import 'dotenv/config';
import { z } from 'zod';
import crypto from 'node:crypto';

/**
 * Zentrale, zod-validierte Konfiguration. Geheimnisse kommen ausschliesslich
 * aus ENV-Variablen (siehe .env.example). In Produktion sind sicherheitskritische
 * Werte zwingend; in Entwicklung/Test werden fehlende Werte mit einer Warnung
 * durch sichere Zufallswerte ersetzt, damit lokale Läufe nicht scheitern.
 */

const isProd = process.env.NODE_ENV === 'production';

function devFallback(name: string, generate: () => string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (isProd) {
    throw new Error(`Pflicht-ENV-Variable fehlt in Produktion: ${name}`);
  }
  const generated = generate();
  // eslint-disable-next-line no-console
  console.warn(
    `[config] ${name} ist nicht gesetzt — verwende einen temporären Entwicklungswert. ` +
      `Für Produktion zwingend in der ENV setzen.`,
  );
  return generated;
}

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL ist erforderlich'),

  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET muss mind. 16 Zeichen haben'),
  // 32-Byte-Schlüssel als hex/base64/utf8 — wird zu 32 Byte normalisiert.
  ENCRYPTION_KEY: z.string().min(16, 'ENCRYPTION_KEY muss mind. 16 Zeichen haben'),

  // SMTP — optional. Fehlt es, schreibt der Mailer in dev in die Konsole.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Stripe — optional beim Boot; Billing-Endpunkte prüfen zur Laufzeit.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_YEARLY: z.string().optional(),
  STRIPE_PRICE_LIFETIME: z.string().optional(),

  // Cookie-Verhalten. In Produktion sind secure-Cookies Pflicht (TLS).
  TRUST_PROXY: z.coerce.boolean().default(false),
});

// Leere Strings aus der ENV als "nicht gesetzt" (undefined) behandeln, damit
// optionale Felder (z. B. leeres SMTP_PORT=) nicht fälschlich validiert werden.
const cleanedEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v]),
);

const parsed = rawSchema.safeParse({
  ...cleanedEnv,
  SESSION_SECRET: devFallback('SESSION_SECRET', () => crypto.randomBytes(32).toString('hex')),
  ENCRYPTION_KEY: devFallback('ENCRYPTION_KEY', () => crypto.randomBytes(32).toString('hex')),
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Ungültige Umgebungskonfiguration:\n${issues}`);
  throw new Error('Umgebungskonfiguration ungültig — Start abgebrochen.');
}

const e = parsed.data;

export const env = {
  ...e,
  isProd,
  isTest: e.NODE_ENV === 'test',
  smtpConfigured: Boolean(e.SMTP_HOST && e.SMTP_PORT && e.SMTP_FROM),
  stripeConfigured: Boolean(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET),
};

export type AppEnv = typeof env;

/** Die Stripe-Price-ID für einen gewählten Plan/Typ. */
export function priceIdFor(interval: 'monthly' | 'yearly' | 'lifetime'): string | undefined {
  switch (interval) {
    case 'monthly':
      return env.STRIPE_PRICE_MONTHLY;
    case 'yearly':
      return env.STRIPE_PRICE_YEARLY;
    case 'lifetime':
      return env.STRIPE_PRICE_LIFETIME;
  }
}
