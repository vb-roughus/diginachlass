import PDFDocument from 'pdfkit';
import type { Writable } from 'node:stream';
import {
  DEATH_HANDLING_GUIDE,
  GENERAL_SECTIONS,
  WHITEPAPER_DISCLAIMER,
  guideEntryForService,
  type GuideEntry,
} from './whitepaperContent';

/**
 * Erzeugt das Premium-White-Paper „Digitaler Nachlass" als PDF und streamt es
 * in den übergebenen Writable-Stream (in der Regel die Express-Response).
 * Enthält die persönlichen Risikoindikatoren des Nutzers sowie recherchierte,
 * offizielle Anlaufstellen und allgemeine Hinweise zur Nachlasshandhabung.
 */

export interface WhitepaperContext {
  userName?: string | null;
  date: Date;
  compendium: {
    total: number;
    trustedPersons: number;
    completeness: number;
    risks: string[];
    categories: { items: { serviceName: string }[] }[];
  };
}

const FOREST = '#1F4A43';
const FOREST_DEEP = '#143A33';
const CLAY = '#C8633B';
const INK = '#1B2A26';
const SOFT = '#51625B';
const LINE = '#D9D3C7';

export function generateWhitepaper(stream: Writable, ctx: WhitepaperContext): void {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 56, bottom: 64, left: 56, right: 56 },
    bufferPages: true,
    info: { Title: 'White Paper — Digitaler Nachlass', Author: 'diginachlass.ch' },
  });
  doc.pipe(stream);

  const left = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const ensure = (space: number): void => {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + space > bottom) doc.addPage();
  };
  const rule = (): void => {
    doc.moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).lineWidth(0.7).strokeColor(LINE).stroke();
    doc.moveDown(0.6);
  };
  const h1 = (t: string): void => { doc.font('Helvetica-Bold').fontSize(22).fillColor(FOREST_DEEP).text(t); doc.moveDown(0.3); };
  const h2 = (t: string): void => { ensure(64); doc.moveDown(0.5); doc.font('Helvetica-Bold').fontSize(15).fillColor(FOREST).text(t); doc.moveDown(0.35); };
  const h3 = (t: string, tag?: string): void => {
    ensure(52);
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor(INK).text(t, { continued: Boolean(tag) });
    if (tag) doc.font('Helvetica-Bold').fontSize(9).fillColor(CLAY).text('   ' + tag);
    doc.moveDown(0.2);
  };
  const body = (t: string): void => { doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(t, { align: 'left', lineGap: 1.5 }); doc.moveDown(0.3); };
  const small = (t: string): void => { doc.font('Helvetica-Oblique').fontSize(9).fillColor(SOFT).text(t, { lineGap: 1 }); doc.moveDown(0.2); };
  const steps = (items: string[]): void => {
    doc.font('Helvetica').fontSize(10.5).fillColor(INK);
    for (const it of items) {
      ensure(26);
      doc.text('•  ' + it, { width: contentWidth, align: 'left', lineGap: 1.5 });
      doc.moveDown(0.15);
    }
    doc.moveDown(0.25);
  };
  const linkPair = (label: string, url: string): void => {
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(FOREST).text(label, { link: url, underline: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(SOFT).text(url, { link: url, underline: true });
    doc.moveDown(0.25);
  };

  // --- Kopf -----------------------------------------------------------------
  doc.font('Helvetica-Bold').fontSize(16).fillColor(FOREST).text('diginachlass', { continued: true }).fillColor(CLAY).text('.ch');
  doc.moveDown(0.6);
  h1('White Paper: Digitaler Nachlass');
  doc.font('Helvetica').fontSize(12).fillColor(SOFT).text('Persönlicher Leitfaden zur Nachlasshandhabung und Risikoübersicht');
  doc.moveDown(0.4);
  const dateStr = ctx.date.toLocaleDateString('de-CH', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.font('Helvetica').fontSize(9.5).fillColor(SOFT).text(`Erstellt für: ${ctx.userName || 'Sie'}  ·  Stand: ${dateStr}`);
  doc.moveDown(0.6);
  rule();
  body(
    'Dieses Dokument fasst die aktuell in Ihrem Compendium erkannten Risikoindikatoren zusammen und ' +
      'zeigt konkrete Anlaufstellen, wie im Todesfall mit den Konten bei den wichtigsten Anbietern zu ' +
      'verfahren ist. Bewahren Sie es zusammen mit Ihren übrigen Vorsorgeunterlagen auf.',
  );

  // --- 1. Risikoübersicht ---------------------------------------------------
  h2('1. Ihre Risikoübersicht');
  body(
    `Vollständigkeit Ihres Compendiums: ${ctx.compendium.completeness} %.  ` +
      `Erfasste Dienste: ${ctx.compendium.total}.  ` +
      `Hinterlegte Vertrauenspersonen: ${ctx.compendium.trustedPersons}.`,
  );
  if (ctx.compendium.risks.length > 0) {
    h3('Erkannte Risikoindikatoren');
    steps(ctx.compendium.risks);
  } else {
    body('Aktuell wurden keine offensichtlichen Risiken erkannt. Halten Sie Ihr Compendium weiterhin aktuell.');
  }

  // Personalisierung: welche erfassten Dienste haben unten eine Anleitung?
  const userServices = ctx.compendium.categories.flatMap((c) => c.items.map((i) => i.serviceName));
  const matched = new Set<GuideEntry>();
  for (const s of userServices) {
    const e = guideEntryForService(s);
    if (e) matched.add(e);
  }
  if (matched.size > 0) {
    body(
      'Zu folgenden von Ihnen erfassten Diensten finden Sie im nächsten Abschnitt konkrete Anleitungen: ' +
        [...matched].map((e) => e.service).join(', ') + '.',
    );
  }

  // --- 2. Anlaufstellen -----------------------------------------------------
  h2('2. Anlaufstellen bei wichtigen Anbietern');
  body('Für jeden Anbieter finden Sie die zuständige Stelle, die nötigen Schritte und den offiziellen Link.');
  for (const entry of DEATH_HANDLING_GUIDE) {
    ensure(140);
    h3(`${entry.service}  (${entry.category})`, matched.has(entry) ? 'betrifft Ihr Konto' : undefined);
    body(entry.contactPoint);
    steps(entry.steps);
    for (const l of entry.links) linkPair(l.label, l.url);
    if (entry.note) small('Hinweis: ' + entry.note);
    if (!entry.verified) small('Diese Angabe ist ohne bestätigtes Self-Service-Formular; bitte prüfen Sie den aktuellen Support des Anbieters.');
    doc.moveDown(0.5);
  }

  // --- 3. Rechtliches & Vorsorge -------------------------------------------
  h2('3. Rechtliche Einordnung & Vorsorge');
  for (const section of GENERAL_SECTIONS) {
    h3(section.title);
    for (const p of section.paragraphs) body(p);
    doc.moveDown(0.2);
  }

  // --- Hinweis / Haftungsausschluss ----------------------------------------
  h2('Wichtiger Hinweis');
  small(WHITEPAPER_DISCLAIMER);

  // --- Fußzeile mit Seitenzahlen -------------------------------------------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 44;
    doc.font('Helvetica').fontSize(8).fillColor(SOFT);
    doc.text('diginachlass.ch — White Paper Digitaler Nachlass', left, y, { lineBreak: false });
    doc.text(`Seite ${i - range.start + 1} von ${range.count}`, left, y, { width: contentWidth, align: 'right', lineBreak: false });
  }

  doc.end();
}
