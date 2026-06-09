import Stripe from 'stripe';
import type {
  CheckoutResult,
  CreateCheckoutInput,
  PaymentProvider,
  PortalInput,
  WebhookResult,
} from './PaymentProvider';
import { env, priceIdFor } from '../config/env';
import { prisma } from '../db/prisma';
import { AppError } from '../middleware/error';
import { logger, recordSecurityEvent } from '../lib/logger';
import { ensureEntitlement, getStatusForUser } from '../services/entitlement';
import { nextReceiptNumber } from '../lib/receipts';
import { sendReceiptEmail } from '../lib/emails';
import type {
  EntitlementStatus,
  PaymentMethodType,
} from '@prisma/client';

/**
 * Stripe-Implementierung der PaymentProvider-Schnittstelle.
 * - Abo (monatlich/jährlich): Stripe Billing, mode 'subscription', nur Karten/Wallets.
 * - Einmalzahlung (lifetime):  Stripe Checkout, mode 'payment', Twint + Karten/Wallets.
 * - Bestätigung AUSSCHLIESSLICH serverseitig per signiertem Webhook.
 */

function mapStripeStatus(status: Stripe.Subscription.Status): EntitlementStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'incomplete_expired';
    case 'paused':
      return 'past_due';
    default:
      return 'none';
  }
}

function periodEndOf(sub: Stripe.Subscription): Date | null {
  // current_period_end liegt je nach API-Version auf der Subscription oder am Item.
  const anySub = sub as unknown as { current_period_end?: number };
  const ts =
    anySub.current_period_end ??
    (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)
      ?.current_period_end;
  return typeof ts === 'number' ? new Date(ts * 1000) : null;
}

function mapPaymentMethod(type: string | null | undefined): PaymentMethodType {
  switch (type) {
    case 'twint':
      return 'twint';
    case 'card':
      return 'card';
    case 'link':
    case 'apple_pay':
    case 'google_pay':
      return 'wallet';
    default:
      return 'other';
  }
}

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private client: Stripe | null;

  constructor() {
    this.client = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  }

  isConfigured(): boolean {
    return Boolean(this.client && env.STRIPE_WEBHOOK_SECRET);
  }

  private stripe(): Stripe {
    if (!this.client) {
      throw new AppError(503, 'Zahlungen sind derzeit nicht verfügbar (Stripe nicht konfiguriert).', {
        code: 'STRIPE_NICHT_KONFIGURIERT',
      });
    }
    return this.client;
  }

  /** Holt oder erstellt den Stripe-Kunden und persistiert die ID am Entitlement. */
  private async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const ent = await ensureEntitlement(userId);
    if (ent.stripeCustomerId) return ent.stripeCustomerId;

    const customer = await this.stripe().customers.create({
      email,
      metadata: { userId },
    });
    await prisma.entitlement.update({
      where: { userId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const priceId = priceIdFor(input.interval);
    if (!priceId) {
      throw new AppError(503, 'Für diesen Plan ist kein Preis konfiguriert.', {
        code: 'PREIS_FEHLT',
      });
    }

    const customerId = await this.getOrCreateCustomer(input.userId, input.email);
    const isLifetime = input.interval === 'lifetime';

    const successUrl = `${env.APP_BASE_URL}/app/upgrade.html?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${env.APP_BASE_URL}/app/upgrade.html?status=cancel`;

    const session = await this.stripe().checkout.sessions.create({
      mode: isLifetime ? 'payment' : 'subscription',
      customer: customerId,
      client_reference_id: input.userId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Twint nur bei Einmalzahlung; Stripe unterstützt mit Twint keine Abos.
      // Apple/Google Pay werden bei 'card' im Checkout automatisch angeboten.
      payment_method_types: isLifetime ? ['card', 'twint'] : ['card'],
      // Stripe Tax bleibt deaktiviert (Betreiber nicht MwSt-pflichtig).
      automatic_tax: { enabled: false },
      locale: 'de',
      metadata: { userId: input.userId, interval: input.interval },
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(isLifetime ? {} : { subscription_data: { metadata: { userId: input.userId } } }),
    });

    if (!session.url) {
      throw new AppError(502, 'Checkout konnte nicht gestartet werden.');
    }
    await recordSecurityEvent({
      type: 'checkout_started',
      userId: input.userId,
      meta: { interval: input.interval, mode: isLifetime ? 'payment' : 'subscription' },
    });
    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(input: PortalInput): Promise<{ url: string }> {
    const ent = await ensureEntitlement(input.userId);
    if (!ent.stripeCustomerId) {
      throw new AppError(400, 'Kein Abonnement vorhanden.', { code: 'KEIN_KUNDE' });
    }
    const session = await this.stripe().billingPortal.sessions.create({
      customer: ent.stripeCustomerId,
      return_url: input.returnUrl ?? `${env.APP_BASE_URL}/app/account.html`,
    });
    return { url: session.url };
  }

  async cancelSubscription(subscriptionId: string, opts?: { immediate?: boolean }): Promise<void> {
    if (opts?.immediate) {
      await this.stripe().subscriptions.cancel(subscriptionId);
    } else {
      await this.stripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    }
  }

  async cancelSubscriptionForUser(userId: string, opts?: { immediate?: boolean }): Promise<void> {
    const ent = await prisma.entitlement.findUnique({ where: { userId } });
    if (!ent?.stripeSubscriptionId) {
      throw new AppError(400, 'Kein aktives Abonnement zum Kündigen gefunden.', {
        code: 'KEIN_ABO',
      });
    }
    await this.cancelSubscription(ent.stripeSubscriptionId, opts);
  }

  getStatus(userId: string) {
    return getStatusForUser(userId);
  }

  // -------------------------------------------------------------------------
  // Webhook
  // -------------------------------------------------------------------------

  async handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookResult> {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError(503, 'Webhook nicht konfiguriert.');
    }
    let event: Stripe.Event;
    try {
      event = this.stripe().webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      logger.warn('stripe_webhook_signature_failed');
      throw new AppError(400, 'Ungültige Webhook-Signatur.', { code: 'WEBHOOK_SIGNATUR' });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.paid':
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        logger.info('stripe_webhook_ignored', { type: event.type });
    }

    return { received: true, type: event.type };
  }

  private async resolveUserId(opts: {
    clientReferenceId?: string | null;
    metadataUserId?: string | null;
    customerId?: string | null;
  }): Promise<string | null> {
    if (opts.clientReferenceId) return opts.clientReferenceId;
    if (opts.metadataUserId) return opts.metadataUserId;
    if (opts.customerId) {
      const ent = await prisma.entitlement.findFirst({
        where: { stripeCustomerId: opts.customerId },
        select: { userId: true },
      });
      return ent?.userId ?? null;
    }
    return null;
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = await this.resolveUserId({
      clientReferenceId: session.client_reference_id,
      metadataUserId: session.metadata?.userId,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    });
    if (!userId) {
      logger.warn('checkout_completed_no_user', { session: session.id });
      return;
    }

    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

    if (session.mode === 'payment') {
      // Einmalzahlung (lifetime)
      await prisma.entitlement.update({
        where: { userId },
        data: {
          plan: 'premium',
          type: 'lifetime',
          status: 'active',
          validUntil: null,
          stripeCustomerId: customerId ?? undefined,
          stripePaymentIntentId:
            typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
        },
      });
      await recordSecurityEvent({ type: 'entitlement_granted', userId, meta: { type: 'lifetime' } });

      await this.recordPaymentForCheckout(userId, session);
    } else if (session.mode === 'subscription') {
      // Abo: Subscription-Objekt laden und Entitlement setzen.
      const subId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
      if (subId) {
        const sub = await this.stripe().subscriptions.retrieve(subId);
        await this.upsertSubscriptionEntitlement(userId, sub, customerId);
      }
      // Beleg für die erste Zahlung kommt über invoice.paid.
    }
  }

  private async upsertSubscriptionEntitlement(
    userId: string,
    sub: Stripe.Subscription,
    customerId: string | null,
  ): Promise<void> {
    await prisma.entitlement.update({
      where: { userId },
      data: {
        plan: 'premium',
        type: 'subscription',
        status: mapStripeStatus(sub.status),
        validUntil: periodEndOf(sub),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        stripeSubscriptionId: sub.id,
        stripeCustomerId: customerId ?? (typeof sub.customer === 'string' ? sub.customer : undefined),
      },
    });
  }

  private async onSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const userId = await this.resolveUserId({
      metadataUserId: sub.metadata?.userId,
      customerId,
    });
    if (!userId) return;
    await this.upsertSubscriptionEntitlement(userId, sub, customerId);
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const userId = await this.resolveUserId({
      metadataUserId: sub.metadata?.userId,
      customerId,
    });
    if (!userId) return;
    // Premium entziehen: zurück auf free.
    await prisma.entitlement.update({
      where: { userId },
      data: {
        plan: 'free',
        type: null,
        status: 'canceled',
        validUntil: null,
        cancelAtPeriodEnd: false,
      },
    });
    await recordSecurityEvent({ type: 'entitlement_revoked', userId, meta: { reason: 'subscription_deleted' } });
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
    const userId = await this.resolveUserId({ customerId });
    if (!userId) return;

    // Entitlement aktuell halten (validUntil) via zugehöriger Subscription.
    const subId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription | null)?.id;
    if (subId) {
      const sub = await this.stripe().subscriptions.retrieve(subId);
      await this.upsertSubscriptionEntitlement(userId, sub, customerId);
    }

    // Beleg (idempotent: pro Invoice nur einmal).
    if (invoice.id) {
      const existing = await prisma.payment.findFirst({
        where: { stripeInvoiceId: invoice.id },
      });
      if (existing) return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return;

    const receiptNumber = await nextReceiptNumber();
    const amount = invoice.amount_paid;
    const currency = (invoice.currency ?? 'chf').toUpperCase();
    await prisma.payment.create({
      data: {
        userId,
        amount,
        currency,
        method: 'card', // Abos: nur Karten/Wallets
        status: 'succeeded',
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId:
          typeof invoice.payment_intent === 'string' ? invoice.payment_intent : undefined,
        stripeChargeId: typeof invoice.charge === 'string' ? invoice.charge : undefined,
        receiptNumber,
        description: 'diginachlass.ch Premium (Abo)',
      },
    });

    await sendReceiptEmail({
      to: user.email,
      receiptNumber,
      description: 'diginachlass.ch Premium (Abo)',
      amount,
      currency,
      method: 'Karte',
      date: new Date(),
    });
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
    const userId = await this.resolveUserId({ customerId });
    if (!userId) return;
    await prisma.entitlement.updateMany({
      where: { userId },
      data: { status: 'past_due' },
    });
    await recordSecurityEvent({ type: 'payment_failed', userId });
  }

  private async recordPaymentForCheckout(
    userId: string,
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    if (session.id) {
      const existing = await prisma.payment.findFirst({
        where: { stripeCheckoutSessionId: session.id },
      });
      if (existing) return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return;

    // Zahlungsmittel & Charge aus dem PaymentIntent ermitteln.
    let methodType: PaymentMethodType = 'other';
    let chargeId: string | undefined;
    const piId = typeof session.payment_intent === 'string' ? session.payment_intent : undefined;
    if (piId) {
      try {
        const pi = await this.stripe().paymentIntents.retrieve(piId, {
          expand: ['latest_charge'],
        });
        const charge = pi.latest_charge as Stripe.Charge | null;
        chargeId = charge?.id;
        methodType = mapPaymentMethod(charge?.payment_method_details?.type);
      } catch {
        // best effort
      }
    }

    const receiptNumber = await nextReceiptNumber();
    const amount = session.amount_total ?? 0;
    const currency = (session.currency ?? 'chf').toUpperCase();
    const methodLabel =
      methodType === 'twint' ? 'Twint' : methodType === 'card' ? 'Karte' : methodType === 'wallet' ? 'Wallet' : 'Online';

    await prisma.payment.create({
      data: {
        userId,
        amount,
        currency,
        method: methodType,
        status: 'succeeded',
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: piId,
        stripeChargeId: chargeId,
        receiptNumber,
        description: 'diginachlass.ch Premium (Einmalzahlung, lebenslang)',
      },
    });

    await sendReceiptEmail({
      to: user.email,
      receiptNumber,
      description: 'diginachlass.ch Premium (Einmalzahlung, lebenslang)',
      amount,
      currency,
      method: methodLabel,
      date: new Date(),
    });
  }
}
