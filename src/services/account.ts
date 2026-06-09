import { prisma } from '../db/prisma';
import { getPaymentProvider } from '../payments';
import { recordSecurityEvent } from '../lib/logger';
import { logger } from '../lib/logger';

/**
 * DSG/DSGVO-Funktionen: vollständiger Datenexport (Auskunft) und permanente
 * Kontolöschung (Recht auf Löschung). Sensible interne Felder (password_hash,
 * verschlüsselte TOTP-Secrets, Token-Hashes) werden NICHT exportiert.
 */

export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerifiedAt: true,
      totpEnabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const [nachlassAccounts, trustedPersons, entitlement, payments, securityEvents] =
    await Promise.all([
      prisma.nachlassAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.trustedPerson.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.entitlement.findUnique({
        where: { userId },
        select: {
          plan: true,
          type: true,
          status: true,
          validUntil: true,
          cancelAtPeriodEnd: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          amount: true,
          currency: true,
          method: true,
          status: true,
          receiptNumber: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.securityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { type: true, ip: true, userAgent: true, createdAt: true },
      }),
    ]);

  return {
    exportiertAm: new Date().toISOString(),
    hinweis:
      'Dieser Export enthält alle zu Ihrem Konto gespeicherten Daten. Es werden ausschliesslich Metadaten zu Ihren Diensten gespeichert — niemals Zugangsdaten oder Geheimnisse von Drittkonten.',
    konto: user,
    dienste: nachlassAccounts,
    vertrauenspersonen: trustedPersons,
    entitlement,
    zahlungen: payments,
    sicherheitsereignisse: securityEvents,
  };
}

/**
 * Permanente Kontolöschung. Kündigt zuvor ein laufendes Stripe-Abo (best effort)
 * und löscht anschliessend den Nutzer — zugehörige Daten werden per ON DELETE
 * CASCADE mit entfernt.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const ent = await prisma.entitlement.findUnique({ where: { userId } });
  if (ent?.stripeSubscriptionId) {
    try {
      await getPaymentProvider().cancelSubscription(ent.stripeSubscriptionId, { immediate: true });
    } catch (err) {
      // Löschung darf an einem Stripe-Fehler nicht scheitern.
      logger.warn('cancel_subscription_on_delete_failed', { userId });
    }
  }

  await recordSecurityEvent({ type: 'account_deleted', userId });
  await prisma.user.delete({ where: { id: userId } });
}
