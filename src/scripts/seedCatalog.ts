/**
 * Befüllt den Dienst-Katalog mit der Standardauswahl (inkl. typischer Schweizer
 * Anbieter). Idempotent: bereits vorhandene Namen bleiben unverändert, es werden
 * nur fehlende Einträge ergänzt — bestehende Anpassungen des Administrators
 * werden also nicht überschrieben.
 *
 * Aufruf:
 *   npm run catalog:seed
 */
import { prisma } from '../db/prisma';

type Category =
  | 'kommunikation'
  | 'social_media'
  | 'finanzen'
  | 'cloud'
  | 'krypto'
  | 'unterhaltung'
  | 'sonstiges';

const CATALOG: Array<{ category: Category; services: string[] }> = [
  {
    category: 'kommunikation',
    services: ['Gmail', 'Outlook / Hotmail', 'GMX', 'Bluewin', 'Proton Mail', 'Sunrise', 'Salt', 'WhatsApp', 'Threema', 'Telegram', 'Signal'],
  },
  {
    category: 'social_media',
    services: ['Facebook', 'Instagram', 'X (Twitter)', 'LinkedIn', 'TikTok', 'Snapchat', 'Pinterest', 'Reddit'],
  },
  {
    category: 'finanzen',
    services: ['PayPal', 'TWINT', 'PostFinance', 'UBS', 'Raiffeisen', 'Kantonalbank (ZKB)', 'Migros Bank', 'Yuh', 'Swissquote', 'Viseca (Kreditkarte)', 'Revolut', 'Wise', 'Neon'],
  },
  {
    category: 'cloud',
    services: ['Google Drive', 'iCloud', 'Dropbox', 'OneDrive', 'pCloud', 'Proton Drive', 'Infomaniak kDrive'],
  },
  {
    category: 'krypto',
    services: ['Bitcoin-Wallet', 'Coinbase', 'Binance', 'Kraken', 'Ledger', 'MetaMask'],
  },
  {
    category: 'unterhaltung',
    services: ['Netflix', 'Spotify', 'Disney+', 'Amazon Prime', 'YouTube', 'Blue TV', 'Zattoo', 'Steam', 'Apple Music', 'PlayStation Network', 'Twitch'],
  },
  {
    category: 'sonstiges',
    services: ['Amazon', 'Apple ID', 'Microsoft-Konto', 'Google-Konto', 'SwissID', 'SBB (SwissPass)', 'Cumulus (Migros)', 'Supercard (Coop)', 'Ricardo', 'Galaxus', 'eBay'],
  },
];

async function main(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const group of CATALOG) {
    for (let i = 0; i < group.services.length; i++) {
      const name = group.services[i];
      const existing = await prisma.catalogService.findUnique({ where: { name } });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.catalogService.create({
        data: { name, category: group.category, sortOrder: i },
      });
      created++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Dienst-Katalog: ${created} neu angelegt, ${skipped} bereits vorhanden.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Fehler:', err);
  await prisma.$disconnect();
  process.exit(1);
});
