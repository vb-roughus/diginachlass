/**
 * Bootstrap-Skript: erstellt einen Administrator oder stuft einen bestehenden
 * Nutzer zum Administrator hoch. Es gibt bewusst KEINE Web-UI dafür.
 *
 * Aufruf:
 *   npx tsx src/scripts/createAdmin.ts admin@example.com 'EinSicheresPasswort1'
 *   # oder ENV: ADMIN_EMAIL, ADMIN_PASSWORD
 */
import { prisma } from '../db/prisma';
import { hashPassword } from '../lib/password';
import { ensureEntitlement } from '../services/entitlement';

async function main(): Promise<void> {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.error('Aufruf: npx tsx src/scripts/createAdmin.ts <email> <passwort>');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'admin', emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
    });
    // eslint-disable-next-line no-console
    console.log(`Bestehender Nutzer ${email} wurde zum Administrator hochgestuft.`);
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: 'admin',
        emailVerifiedAt: new Date(),
      },
    });
    await ensureEntitlement(user.id);
    // eslint-disable-next-line no-console
    console.log(`Administrator ${email} wurde erstellt.`);
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Fehler:', err);
  await prisma.$disconnect();
  process.exit(1);
});
