import { env } from '../config/env';
import { sendMail } from './mailer';

/**
 * Deutschsprachige E-Mail-Vorlagen (Verifizierung, Passwort-Reset, Belege).
 * Schlichtes, seriöses Layout im Sinne der Marke.
 */

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="de"><body style="margin:0;background:#F6F2EA;font-family:Helvetica,Arial,sans-serif;color:#1B2A26">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="font-size:20px;font-weight:700;color:#1F4A43;margin-bottom:24px">diginachlass<span style="color:#C8633B">.ch</span></div>
    <div style="background:#FCFAF4;border:1px solid rgba(27,42,38,.12);border-radius:16px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 16px;color:#143A33">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="font-size:12px;color:#51625B;margin-top:24px">
      diginachlass.ch — Ihre digitalen Konten, geordnet für den Ernstfall.<br>
      Diese Nachricht wurde automatisch versendet. Bitte antworten Sie nicht darauf.
    </p>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1F4A43;color:#F6F2EA;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${label}</a>`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = `${env.APP_BASE_URL}/app/verify-email.html?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: 'Bitte bestätigen Sie Ihre E-Mail-Adresse',
    html: layout(
      'E-Mail-Adresse bestätigen',
      `<p style="color:#51625B;line-height:1.6">Willkommen bei diginachlass.ch. Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren. Der Link ist 24 Stunden gültig.</p>
       <p style="margin:24px 0">${button(url, 'E-Mail bestätigen')}</p>
       <p style="color:#51625B;font-size:13px">Falls der Button nicht funktioniert, öffnen Sie diesen Link:<br><span style="word-break:break-all">${url}</span></p>`,
    ),
    text: `Willkommen bei diginachlass.ch.\n\nBitte bestätigen Sie Ihre E-Mail-Adresse (gültig 24 Stunden):\n${url}\n`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = `${env.APP_BASE_URL}/app/reset-password.html?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: 'Passwort zurücksetzen',
    html: layout(
      'Passwort zurücksetzen',
      `<p style="color:#51625B;line-height:1.6">Sie haben das Zurücksetzen Ihres Passworts angefordert. Der Link ist 1 Stunde gültig. Falls Sie das nicht waren, können Sie diese E-Mail ignorieren.</p>
       <p style="margin:24px 0">${button(url, 'Neues Passwort festlegen')}</p>
       <p style="color:#51625B;font-size:13px">Oder dieser Link:<br><span style="word-break:break-all">${url}</span></p>`,
    ),
    text: `Passwort zurücksetzen (Link gültig 1 Stunde):\n${url}\n\nFalls Sie das nicht angefordert haben, ignorieren Sie diese E-Mail.`,
  });
}

export interface ReceiptData {
  to: string;
  receiptNumber: string;
  description: string;
  amount: number; // Rappen
  currency: string;
  method: string;
  date: Date;
}

function formatCHF(rappen: number, currency: string): string {
  return `${currency} ${(rappen / 100).toFixed(2)}`;
}

export async function sendReceiptEmail(data: ReceiptData): Promise<void> {
  const dateStr = data.date.toLocaleDateString('de-CH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const amount = formatCHF(data.amount, data.currency);
  await sendMail({
    to: data.to,
    subject: `Ihre Zahlungsbestätigung ${data.receiptNumber}`,
    html: layout(
      'Zahlungsbestätigung',
      `<p style="color:#51625B;line-height:1.6">Vielen Dank für Ihren Kauf. Hier ist Ihre Bestätigung.</p>
       <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
         <tr><td style="padding:8px 0;color:#51625B">Belegnummer</td><td style="padding:8px 0;text-align:right;font-weight:600">${data.receiptNumber}</td></tr>
         <tr><td style="padding:8px 0;color:#51625B">Datum</td><td style="padding:8px 0;text-align:right">${dateStr}</td></tr>
         <tr><td style="padding:8px 0;color:#51625B">Leistung</td><td style="padding:8px 0;text-align:right">${data.description}</td></tr>
         <tr><td style="padding:8px 0;color:#51625B">Zahlungsmittel</td><td style="padding:8px 0;text-align:right">${data.method}</td></tr>
         <tr><td style="padding:12px 0;border-top:1px solid rgba(27,42,38,.12);font-weight:700">Betrag</td><td style="padding:12px 0;border-top:1px solid rgba(27,42,38,.12);text-align:right;font-weight:700">${amount}</td></tr>
       </table>
       <p style="color:#51625B;font-size:12px">Hinweis: Es wird keine Mehrwertsteuer ausgewiesen (Anbieter derzeit nicht MwSt-pflichtig).</p>`,
    ),
    text: `Zahlungsbestätigung diginachlass.ch\n\nBelegnummer: ${data.receiptNumber}\nDatum: ${dateStr}\nLeistung: ${data.description}\nZahlungsmittel: ${data.method}\nBetrag: ${amount}\n\nHinweis: keine MwSt ausgewiesen (Anbieter nicht MwSt-pflichtig).`,
  });
}
