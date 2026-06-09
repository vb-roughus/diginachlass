import type { EntitlementView } from '../services/entitlement';

/**
 * Austauschbare Zahlungs-Abstraktion. Stripe ist die erste konkrete
 * Implementierung; ein späterer Wechsel zu einem Schweizer PSP (z. B. Payrexx)
 * bleibt damit lokal begrenzt.
 *
 * Mapping zur Auftrags-Spezifikation:
 *   createCheckout(plan, type) -> createCheckout({ interval })
 *   handleWebhook(req)         -> handleWebhook(rawBody, signature)
 *   cancelSubscription(id)     -> cancelSubscription(subscriptionId)
 *   getStatus(userId)          -> getStatus(userId)
 */
export type CheckoutInterval = 'monthly' | 'yearly' | 'lifetime';

export interface CreateCheckoutInput {
  userId: string;
  email: string;
  interval: CheckoutInterval;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

export interface PortalInput {
  userId: string;
  returnUrl?: string;
}

export interface WebhookResult {
  received: boolean;
  type?: string;
}

export interface PaymentProvider {
  readonly name: string;
  isConfigured(): boolean;

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  createPortalSession(input: PortalInput): Promise<{ url: string }>;
  cancelSubscription(subscriptionId: string, opts?: { immediate?: boolean }): Promise<void>;
  cancelSubscriptionForUser(userId: string, opts?: { immediate?: boolean }): Promise<void>;
  handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookResult>;
  getStatus(userId: string): Promise<EntitlementView>;
}
