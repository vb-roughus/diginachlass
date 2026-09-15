import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * E-Mail-Versand über konfigurierbares SMTP (z. B. Infomaniak).
 * Ist kein SMTP konfiguriert (lokale Entwicklung/Test), wird die E-Mail in die
 * Konsole geschrieben statt versendet.
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtpConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // 465 = implizites TLS, sonst STARTTLS
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** In Tests gesendete E-Mails (statt SMTP), damit Tests Tokens auslesen können. */
export const testMailbox: MailMessage[] = [];

/** Nur für Tests: erzwingt einen fehlgeschlagenen Versand (prüft den Fehlerpfad). */
export const testMailFailure = { enabled: false };

/**
 * Versendet eine E-Mail. Wirft NIEMALS: ein fehlgeschlagener Versand darf einen
 * laufenden Request (Registrierung, Passwort-Reset, Stripe-Webhook) nicht
 * abbrechen — sonst entstünde z. B. ein angelegtes Konto mit HTTP 500, das sich
 * nicht mehr registrieren lässt. Fehler werden protokolliert; der Rückgabewert
 * sagt, ob der Versand geklappt hat.
 */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  try {
    if (env.isTest) {
      if (testMailFailure.enabled) throw new Error('Simulierter SMTP-Fehler (Test)');
      testMailbox.push(msg);
      return true;
    }

    const t = getTransporter();
    const from = env.SMTP_FROM ?? 'diginachlass.ch <no-reply@diginachlass.ch>';

    if (!t) {
      logger.info('mail_console_fallback', { to: msg.to, subject: msg.subject });
      // eslint-disable-next-line no-console
      console.log(
        `\n──── E-Mail (SMTP nicht konfiguriert) ────\nAn:      ${msg.to}\nBetreff: ${msg.subject}\n\n${msg.text}\n──────────────────────────────────────────\n`,
      );
      return true;
    }

    await t.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    logger.info('mail_sent', { to: msg.to, subject: msg.subject });
    return true;
  } catch (err) {
    logger.error('mail_failed', {
      to: msg.to,
      subject: msg.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
