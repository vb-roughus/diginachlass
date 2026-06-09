import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/db/prisma';
import { testMailbox } from '../src/lib/mailer';

// Gemeinsame Mock-Funktionen (hoisted, damit vi.mock sie referenzieren kann).
const m = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  subRetrieve: vi.fn(),
  piRetrieve: vi.fn(),
  custCreate: vi.fn(),
}));

vi.mock('stripe', () => {
  class MockStripe {
    webhooks = { constructEvent: (...a: unknown[]) => m.constructEvent(...a) };
    subscriptions = {
      retrieve: (...a: unknown[]) => m.subRetrieve(...a),
      update: vi.fn(),
      cancel: vi.fn(),
    };
    paymentIntents = { retrieve: (...a: unknown[]) => m.piRetrieve(...a) };
    customers = { create: (...a: unknown[]) => m.custCreate(...a) };
    checkout = { sessions: { create: vi.fn() } };
    billingPortal = { sessions: { create: vi.fn() } };
    constructor(_key?: string) {}
  }
  return { default: MockStripe };
});

// Erst nach vi.mock importieren.
import { StripeProvider } from '../src/payments/StripeProvider';

async function makeUser(email: string, customerId?: string) {
  const user = await prisma.user.create({
    data: { email, passwordHash: 'x', emailVerifiedAt: new Date() },
  });
  await prisma.entitlement.create({
    data: { userId: user.id, plan: 'free', status: 'none', stripeCustomerId: customerId ?? null },
  });
  return user;
}

const sig = 't=1,v1=dummy';
const body = Buffer.from('{}');

describe('Stripe Webhook', () => {
  beforeEach(() => {
    m.constructEvent.mockReset();
    m.subRetrieve.mockReset();
    m.piRetrieve.mockReset();
    m.custCreate.mockReset();
  });

  it('ungültige Signatur => Fehler', async () => {
    m.constructEvent.mockImplementation(() => {
      throw new Error('bad sig');
    });
    const provider = new StripeProvider();
    await expect(provider.handleWebhook(body, sig)).rejects.toMatchObject({ status: 400 });
  });

  it('checkout.session.completed (lifetime, Twint) setzt Premium + erstellt Beleg', async () => {
    const user = await makeUser('life@example.com');
    m.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          mode: 'payment',
          client_reference_id: user.id,
          customer: 'cus_life',
          payment_intent: 'pi_life',
          amount_total: 9900,
          currency: 'chf',
          metadata: { userId: user.id, interval: 'lifetime' },
        },
      },
    });
    m.piRetrieve.mockResolvedValue({
      id: 'pi_life',
      latest_charge: { id: 'ch_life', payment_method_details: { type: 'twint' } },
    });

    const provider = new StripeProvider();
    const res = await provider.handleWebhook(body, sig);
    expect(res.received).toBe(true);

    const ent = await prisma.entitlement.findUniqueOrThrow({ where: { userId: user.id } });
    expect(ent.plan).toBe('premium');
    expect(ent.type).toBe('lifetime');
    expect(ent.status).toBe('active');

    const payment = await prisma.payment.findFirstOrThrow({ where: { userId: user.id } });
    expect(payment.amount).toBe(9900);
    expect(payment.method).toBe('twint');
    expect(payment.receiptNumber).toMatch(/^R-\d{4}-\d{6}$/);

    expect(testMailbox.some((mail) => /Zahlungsbestätigung/i.test(mail.subject))).toBe(true);
  });

  it('checkout.session.completed lifetime ist idempotent (kein doppelter Beleg)', async () => {
    const user = await makeUser('idem@example.com');
    m.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_idem',
          mode: 'payment',
          client_reference_id: user.id,
          customer: 'cus_idem',
          payment_intent: 'pi_idem',
          amount_total: 9900,
          currency: 'chf',
          metadata: { userId: user.id },
        },
      },
    });
    m.piRetrieve.mockResolvedValue({ id: 'pi_idem', latest_charge: { id: 'ch', payment_method_details: { type: 'card' } } });

    const provider = new StripeProvider();
    await provider.handleWebhook(body, sig);
    await provider.handleWebhook(body, sig);

    const count = await prisma.payment.count({ where: { userId: user.id } });
    expect(count).toBe(1);
  });

  it('invoice.paid (Abo) aktualisiert validUntil und erstellt Beleg', async () => {
    const user = await makeUser('sub@example.com', 'cus_sub');
    const periodEnd = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    m.constructEvent.mockReturnValue({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_1',
          customer: 'cus_sub',
          subscription: 'sub_1',
          amount_paid: 4900,
          currency: 'chf',
          payment_intent: 'pi_inv',
          charge: 'ch_inv',
        },
      },
    });
    m.subRetrieve.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      customer: 'cus_sub',
      items: { data: [{}] },
      metadata: { userId: user.id },
    });

    const provider = new StripeProvider();
    await provider.handleWebhook(body, sig);

    const ent = await prisma.entitlement.findUniqueOrThrow({ where: { userId: user.id } });
    expect(ent.plan).toBe('premium');
    expect(ent.type).toBe('subscription');
    expect(ent.status).toBe('active');
    expect(ent.validUntil).not.toBeNull();

    const payment = await prisma.payment.findFirstOrThrow({ where: { userId: user.id } });
    expect(payment.amount).toBe(4900);
    expect(payment.stripeInvoiceId).toBe('in_1');
  });

  it('customer.subscription.deleted entzieht Premium (zurück auf free)', async () => {
    const user = await makeUser('cancel@example.com', 'cus_cancel');
    await prisma.entitlement.update({
      where: { userId: user.id },
      data: { plan: 'premium', type: 'subscription', status: 'active', stripeSubscriptionId: 'sub_c' },
    });
    m.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_c', customer: 'cus_cancel', status: 'canceled', metadata: { userId: user.id } },
      },
    });

    const provider = new StripeProvider();
    await provider.handleWebhook(body, sig);

    const ent = await prisma.entitlement.findUniqueOrThrow({ where: { userId: user.id } });
    expect(ent.plan).toBe('free');
    expect(ent.status).toBe('canceled');
  });

  it('invoice.payment_failed setzt Status past_due (kein Premium mehr)', async () => {
    const user = await makeUser('failed@example.com', 'cus_failed');
    await prisma.entitlement.update({
      where: { userId: user.id },
      data: { plan: 'premium', type: 'subscription', status: 'active' },
    });
    m.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_f', customer: 'cus_failed' } },
    });

    const provider = new StripeProvider();
    await provider.handleWebhook(body, sig);

    const ent = await prisma.entitlement.findUniqueOrThrow({ where: { userId: user.id } });
    expect(ent.status).toBe('past_due');
  });
});
