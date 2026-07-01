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
 * Es enthält die persönlichen Risikoindikatoren des Nutzers sowie die
 * recherchierten, offiziellen Anlaufstellen — bewusst nur für die vom Nutzer
 * tatsächlich erfassten Dienste.
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
const PAPER = '#F6F2EA';
const LIGHT = '#CFE0D9';

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
  const h2 = (t: string): void => {
    ensure(72);
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(15).fillColor(FOREST).text(t);
    const yLine = doc.y + 3;
    doc.rect(left, yLine, 46, 3).fill(CLAY);
    doc.fillColor(INK);
    doc.y = yLine + 12;
  };
  const h3 = (t: string): void => {
    ensure(54);
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor(FOREST_DEEP).text(t);
    doc.moveDown(0.15);
  };
  const tag = (t: string): void => {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(CLAY).text(t.toUpperCase(), { characterSpacing: 0.5 });
    doc.moveDown(0.15);
  };
  const betrifft = (t: string): void => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(FOREST).text('Betrifft Ihre erfassten Dienste: ' + t);
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

  // --- Deckblatt ------------------------------------------------------------
  doc.rect(0, 0, doc.page.width, 250).fill(FOREST);
  doc.rect(0, 250, doc.page.width, 4).fill(CLAY);
  doc.font('Helvetica-Bold').fontSize(15).fillColor(LIGHT).text('diginachlass.ch', left, 64);
  doc.font('Helvetica-Bold').fontSize(30).fillColor(PAPER).text('White Paper', left, 108);
  doc.font('Helvetica-Bold').fontSize(30).fillColor(PAPER).text('Digitaler Nachlass', left, 144);
  doc.font('Helvetica').fontSize(12).fillColor(LIGHT).text('Persönlicher Leitfaden zur Nachlasshandhabung und Risikoübersicht', left, 192, { width: contentWidth });

  doc.y = 286;
  doc.x = left;
  doc.font('Helvetica').fontSize(10).fillColor(SOFT)
    .text(`Erstellt für: ${ctx.userName || 'Sie'}     ·     Stand: ${ctx.date.toLocaleDateString('de-CH', { day: '2-digit', month: 'long', year: 'numeric' })}`);
  doc.moveDown(1);
  body(
    'Dieses Dokument fasst die aktuell in Ihrem Compendium erkannten Risikoindikatoren zusammen und ' +
      'zeigt für die von Ihnen erfassten Dienste konkrete Anlaufstellen, wie im Todesfall zu verfahren ist. ' +
      'Bewahren Sie es zusammen mit Ihren übrigen Vorsorgeunterlagen auf.',
  );

  doc.addPage();

  // --- 1. Risikoübersicht ---------------------------------------------------
  h2('1. Ihre Risikoübersicht');
  body(
    `Vollständigkeit Ihres Compendiums: ${ctx.compendium.completeness} %.     ` +
      `Erfasste Dienste: ${ctx.compendium.total}.     ` +
      `Hinterlegte Vertrauenspersonen: ${ctx.compendium.trustedPersons}.`,
  );
  if (ctx.compendium.risks.length > 0) {
    h3('Erkannte Risikoindikatoren');
    steps(ctx.compendium.risks);
  } else {
    body('Aktuell wurden keine offensichtlichen Risiken erkannt. Halten Sie Ihr Compendium weiterhin aktuell.');
  }

  // --- 2. Anlaufstellen — nur für die erfassten Dienste ---------------------
  const userServices = [
    ...new Set(
      ctx.compendium.categories
        .flatMap((c) => c.items.map((i) => i.serviceName))
        .map((s) => (s || '').trim())
        .filter(Boolean),
    ),
  ];
  const matched = new Map<GuideEntry, string[]>();
  const unmatched: string[] = [];
  for (const s of userServices) {
    const e = guideEntryForService(s);
    if (e) {
      const list = matched.get(e) || [];
      list.push(s);
      matched.set(e, list);
    } else {
      unmatched.push(s);
    }
  }

  h2('2. Anlaufstellen für Ihre erfassten Dienste');

  if (matched.size === 0 && unmatched.length === 0) {
    body(
      'Sie haben derzeit keine Dienste im Compendium erfasst. Sobald Sie Dienste hinzufügen, listet dieses ' +
        'White Paper die passenden Anlaufstellen für genau diese Dienste auf.',
    );
  } else {
    body('Nachfolgend finden Sie zu jedem erfassten Dienst die zuständige Stelle, die nötigen Schritte und den offiziellen Link.');
    // In der Reihenfolge des Katalogs ausgeben (stabil), aber nur die Treffer.
    for (const entry of DEATH_HANDLING_GUIDE) {
      const names = matched.get(entry);
      if (!names) continue;
      ensure(150);
      h3(entry.service);
      tag(entry.category);
      betrifft(names.join(', '));
      body(entry.contactPoint);
      steps(entry.steps);
      for (const l of entry.links) linkPair(l.label, l.url);
      if (entry.note) small('Hinweis: ' + entry.note);
      if (!entry.verified) small('Diese Angabe ist ohne bestätigtes Self-Service-Formular; bitte prüfen Sie den aktuellen Support des Anbieters.');
      doc.moveDown(0.4);
      rule();
    }
    if (unmatched.length > 0) {
      ensure(90);
      h3('Weitere erfasste Dienste');
      body('Für die folgenden erfassten Dienste ist keine spezifische Anleitung hinterlegt: ' + unmatched.join(', ') + '.');
      body(
        'Prüfen Sie die Hilfe- bzw. Support-Seiten des jeweiligen Anbieters nach einem Vorgehen im Todesfall ' +
          'und ob sich zu Lebzeiten ein Nachlass- oder Notfallkontakt einrichten lässt.',
      );
    }
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
