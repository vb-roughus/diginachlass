import { prisma } from '../db/prisma';
import type { NachlassAccount, NachlassCategory } from '@prisma/client';

/**
 * Aufbereitung des Compendiums. Die Vorschau (preview) ist kostenlos; das
 * vollständige Compendium inkl. Risikoindikatoren und Vollständigkeitsprüfung
 * ist Premium.
 */

const CATEGORY_LABELS: Record<NachlassCategory, string> = {
  kommunikation: 'Kommunikation',
  social_media: 'Social Media',
  finanzen: 'Finanzen',
  cloud: 'Cloud',
  krypto: 'Krypto',
  unterhaltung: 'Unterhaltung',
  sonstiges: 'Sonstiges',
};

const CATEGORY_ORDER: NachlassCategory[] = [
  'kommunikation',
  'social_media',
  'finanzen',
  'cloud',
  'krypto',
  'unterhaltung',
  'sonstiges',
];

export async function buildPreview(userId: string) {
  const accounts = await prisma.nachlassAccount.findMany({ where: { userId } });
  const total = accounts.length;
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    count: accounts.filter((a) => a.category === cat).length,
  })).filter((c) => c.count > 0);

  const documented = accounts.filter((a) => a.accessDocumented === 'ja').length;
  const highRelevance = accounts.filter((a) => a.relevance === 'hoch').length;

  return {
    plan: 'free' as const,
    total,
    byCategory,
    documented,
    highRelevance,
    hinweis:
      'Dies ist eine kostenlose Basisübersicht. Das vollständige Compendium mit Risikoanalyse, Vollständigkeitsprüfung und Export ist Teil von Premium.',
  };
}

function riskIndicators(accounts: NachlassAccount[], trustedCount: number): string[] {
  const risks: string[] = [];

  const importantUndocumented = accounts.filter(
    (a) => a.relevance === 'hoch' && a.accessDocumented === 'nein',
  );
  for (const a of importantUndocumented) {
    risks.push(`Wichtiges Konto ohne dokumentierten Zugang: ${a.serviceName}.`);
  }

  const finance = accounts.filter((a) => a.category === 'finanzen' || a.category === 'krypto');
  if (finance.length > 0 && trustedCount === 0) {
    risks.push('Finanz-/Kryptokonten vorhanden, aber keine Vertrauensperson hinterlegt.');
  }
  const financeUndoc = finance.filter((a) => a.accessDocumented !== 'ja');
  for (const a of financeUndoc) {
    risks.push(`Finanz-/Kryptokonto mit unvollständig dokumentiertem Zugang: ${a.serviceName}.`);
  }

  const cloudSocialRisk = accounts.filter(
    (a) =>
      (a.category === 'cloud' || a.category === 'social_media') &&
      a.relevance !== 'niedrig' &&
      a.accessDocumented === 'nein',
  );
  for (const a of cloudSocialRisk) {
    risks.push(`Cloud-/Social-Konto ohne dokumentierten Zugang: ${a.serviceName}.`);
  }

  return risks;
}

export async function buildFull(userId: string) {
  const [accounts, trustedCount] = await Promise.all([
    prisma.nachlassAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.trustedPerson.count({ where: { userId } }),
  ]);

  const total = accounts.length;
  const categories = CATEGORY_ORDER.map((cat) => {
    const items = accounts.filter((a) => a.category === cat);
    if (items.length === 0) return null;
    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: items.map((a) => ({
        id: a.id,
        serviceName: a.serviceName,
        relevance: a.relevance,
        accessDocumented: a.accessDocumented,
        notes: a.notes,
      })),
    };
  }).filter((c): c is NonNullable<typeof c> => c !== null);

  const documented = accounts.filter((a) => a.accessDocumented === 'ja').length;
  const partial = accounts.filter((a) => a.accessDocumented === 'teilweise').length;
  // Vollständigkeitsprüfung: gewichtete Dokumentationsquote (teilweise = 0.5),
  // ein kleiner Bonus für eine hinterlegte Vertrauensperson.
  const docScore = total > 0 ? (documented + partial * 0.5) / total : 0;
  const trustBonus = trustedCount > 0 ? 0.1 : 0;
  const completeness = Math.min(100, Math.round((docScore * 0.9 + trustBonus) * 100));

  return {
    plan: 'premium' as const,
    total,
    trustedPersons: trustedCount,
    completeness,
    categories,
    risks: riskIndicators(accounts, trustedCount),
  };
}
