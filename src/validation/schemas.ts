import { z } from 'zod';

/**
 * Zentrale zod-Schemas für die Eingabevalidierung. Alle Fehlermeldungen auf
 * Deutsch und nutzerfreundlich.
 */

export const emailSchema = z
  .string({ required_error: 'E-Mail-Adresse ist erforderlich.' })
  .trim()
  .toLowerCase()
  .email('Bitte geben Sie eine gültige E-Mail-Adresse ein.')
  .max(254, 'E-Mail-Adresse ist zu lang.');

// Starke Passwort-Policy: mind. 10 Zeichen, Gross-, Kleinbuchstabe und Ziffer.
export const passwordSchema = z
  .string({ required_error: 'Passwort ist erforderlich.' })
  .min(10, 'Das Passwort muss mindestens 10 Zeichen lang sein.')
  .max(200, 'Das Passwort darf höchstens 200 Zeichen lang sein.')
  .regex(/[a-zäöü]/, 'Das Passwort muss einen Kleinbuchstaben enthalten.')
  .regex(/[A-ZÄÖÜ]/, 'Das Passwort muss einen Grossbuchstaben enthalten.')
  .regex(/[0-9]/, 'Das Passwort muss eine Ziffer enthalten.');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Passwort ist erforderlich.'),
  // optionaler 2FA-Code direkt beim Login
  totp: z.string().trim().optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10, 'Ungültiger Token.'),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(10, 'Ungültiger Token.'),
  password: passwordSchema,
});

export const updateAccountSchema = z
  .object({
    name: z.string().trim().max(120).nullish(),
    email: emailSchema.optional(),
    newPassword: passwordSchema.optional(),
    // Zur Bestätigung sicherheitsrelevanter Änderungen erforderlich.
    currentPassword: z.string().optional(),
  })
  .refine((d) => d.name !== undefined || d.email !== undefined || d.newPassword !== undefined, {
    message: 'Keine Änderungen angegeben.',
  });

export const twoFactorVerifySchema = z.object({
  token: z.string().trim().min(6, 'Bitte den 6-stelligen Code eingeben.'),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Bitte bestätigen Sie mit Ihrem Passwort.'),
  confirm: z.literal('LÖSCHEN', {
    errorMap: () => ({ message: 'Bitte tippen Sie LÖSCHEN zur Bestätigung.' }),
  }),
});

// --- Nachlass-Metadaten ------------------------------------------------------

export const nachlassCategoryEnum = z.enum([
  'kommunikation',
  'social_media',
  'finanzen',
  'cloud',
  'krypto',
  'unterhaltung',
  'sonstiges',
]);

export const relevanceEnum = z.enum(['niedrig', 'mittel', 'hoch']);
export const accessDocumentedEnum = z.enum(['ja', 'teilweise', 'nein']);

// SCOPE-REGEL: Hier werden ausschliesslich Metadaten erfasst. Es gibt bewusst
// KEIN Feld für Passwörter/Zugangsdaten. "notes" ist für Hinweise gedacht.
export const nachlassAccountSchema = z.object({
  serviceName: z.string().trim().min(1, 'Bitte den Dienst angeben.').max(120),
  provider: z.string().trim().max(80).nullish(),
  category: nachlassCategoryEnum,
  relevance: relevanceEnum.default('mittel'),
  accessDocumented: accessDocumentedEnum.default('nein'),
  notes: z.string().trim().max(2000).nullish(),
});

export const nachlassAccountUpdateSchema = nachlassAccountSchema.partial();

// --- Dienst-Katalog (vom Administrator gepflegt) -----------------------------
// Stammdaten der Auswahlliste — niemals Zugangsdaten.
export const catalogServiceSchema = z.object({
  name: z.string().trim().min(1, 'Bitte einen Namen angeben.').max(120),
  category: nachlassCategoryEnum,
  provider: z.string().trim().max(80).nullish(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
});

export const catalogServiceUpdateSchema = catalogServiceSchema.partial();

export const trustedPersonSchema = z.object({
  name: z.string().trim().min(1, 'Bitte den Namen angeben.').max(120),
  relationship: z.string().trim().min(1, 'Bitte die Beziehung angeben.').max(120),
  email: emailSchema.optional().or(z.literal('').transform(() => undefined)),
});

export const trustedPersonUpdateSchema = trustedPersonSchema.partial();

// --- Billing -----------------------------------------------------------------

export const checkoutSchema = z.object({
  // "subscription" => monatlich/jährlich; "lifetime" => Einmalzahlung
  interval: z.enum(['monthly', 'yearly', 'lifetime'], {
    errorMap: () => ({ message: 'Ungültiger Plan.' }),
  }),
});
