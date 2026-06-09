import type { Entitlement, EntitlementStatus, EntitlementType, Plan } from '@prisma/client';
import { prisma } from '../db/prisma';

/**
 * Entitlement-Logik. Die reine Funktion isPremiumActive() ist die einzige
 * Quelle der Wahrheit für das serverseitige Gating und wird in Tests abgedeckt.
 */

export interface EntitlementView {
  plan: Plan;
  type: EntitlementType | null;
  status: EntitlementStatus;
  premium: boolean;
  validUntil: Date | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Premium ist aktiv, wenn der Plan "premium" ist UND
 *  - lifetime: Status "active" (validUntil = null bedeutet unbegrenzt), oder
 *  - subscription: Status "active"/"trialing" und (kein validUntil ODER validUntil in der Zukunft).
 * Bei past_due/canceled/expired/unpaid wird KEIN Premium gewährt.
 */
export function isPremiumActive(
  ent: Pick<Entitlement, 'plan' | 'type' | 'status' | 'validUntil'> | null,
  now: Date = new Date(),
): boolean {
  if (!ent || ent.plan !== 'premium') return false;

  if (ent.type === 'lifetime') {
    return ent.status === 'active';
  }

  // subscription
  if (ent.status !== 'active' && ent.status !== 'trialing') return false;
  if (ent.validUntil && ent.validUntil.getTime() <= now.getTime()) return false;
  return true;
}

export function toView(
  ent: Pick<
    Entitlement,
    'plan' | 'type' | 'status' | 'validUntil' | 'cancelAtPeriodEnd'
  > | null,
): EntitlementView {
  if (!ent) {
    return {
      plan: 'free',
      type: null,
      status: 'none',
      premium: false,
      validUntil: null,
      cancelAtPeriodEnd: false,
    };
  }
  return {
    plan: ent.plan,
    type: ent.type,
    status: ent.status,
    premium: isPremiumActive(ent),
    validUntil: ent.validUntil,
    cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
  };
}

export async function getEntitlement(userId: string): Promise<Entitlement | null> {
  return prisma.entitlement.findUnique({ where: { userId } });
}

export async function getStatusForUser(userId: string): Promise<EntitlementView> {
  const ent = await getEntitlement(userId);
  return toView(ent);
}

export async function hasActivePremium(userId: string): Promise<boolean> {
  const ent = await getEntitlement(userId);
  return isPremiumActive(ent);
}

/** Stellt sicher, dass ein (free-)Entitlement-Datensatz existiert. */
export async function ensureEntitlement(userId: string): Promise<Entitlement> {
  return prisma.entitlement.upsert({
    where: { userId },
    create: { userId, plan: 'free', status: 'none' },
    update: {},
  });
}
