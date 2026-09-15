import { beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/db/prisma';
import { testMailbox } from '../src/lib/mailer';

const TABLES = [
  'security_events',
  'payments',
  'entitlements',
  'trusted_persons',
  'nachlass_accounts',
  'email_verifications',
  'password_resets',
  'totp_secrets',
  'counters',
  'session',
  'users',
];

async function truncateAll(): Promise<void> {
  // MySQL/MariaDB: TRUNCATE nur einzeln und bei deaktivierten FK-Checks,
  // da die Tabellen über Fremdschlüssel verbunden sind.
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
  try {
    for (const table of TABLES) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
    }
  } finally {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
  }
}

beforeEach(async () => {
  await truncateAll();
  testMailbox.length = 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});
