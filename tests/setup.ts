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
  const list = TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
}

beforeEach(async () => {
  await truncateAll();
  testMailbox.length = 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});
