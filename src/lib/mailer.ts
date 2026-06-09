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

export async function sendMail(msg: MailMessage): Promise<void> {
  if (env.isTest) {
    testMailbox.push(msg);
    return;
  }
  const t = getTransporter();
  const from = env.SMTP_FROM ?? 'diginachlass.ch <no-reply@diginachlass.ch>';

  if (!t) {
    logger.info('mail_console_fallback', { to: msg.to, subject: msg.subject });
    if (!env.isTest) {
      // eslint-disable-next-line no-console
      console.log(
        `\n──── E-Mail (SMTP nicht konfiguriert) ────\nAn:      ${msg.to}\nBetreff: ${msg.subject}\n\n${msg.text}\n──────────────────────────────────────────\n`,
      );
    }
    return;
  }

  await t.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
  logger.info('mail_sent', { to: msg.to, subject: msg.subject });
}
