/**
 * Seed-Skript: legt im Stripe-TEST-Account das Premium-Produkt und die drei
 * Preise (monatlich/jährlich/lebenslang) an und gibt die passenden .env-Zeilen
 * aus. Idempotent: bestehende Preise werden über ihren `lookup_key`
 * wiederverwendet, statt Duplikate zu erzeugen.
 *
 * Aufruf (lokal, mit gesetztem STRIPE_SECRET_KEY in der .env):
 *   npm run stripe:seed
 *   # optional eigene Beträge in CHF: monatlich jährlich lebenslang
 *   npm run stripe:seed -- 4.90 49 99
 *
 * Die ausgegebenen STRIPE_PRICE_*-Zeilen anschliessend in die .env übernehmen.
 */
import Stripe from 'stripe';
import { env } from '../config/env';

const CURRENCY = 'chf';
const PRODUCT_NAME = 'diginachlass Premium';
const PRODUCT_MARKER = { app: 'diginachlass', kind: 'premium' };

interface PlanDef {
  envVar: string;
  lookupKey: string;
  nickname: string;
  amountRappen: number;
  recurring?: { interval: 'month' | 'year' };
}

function chfToRappen(chf: number): number {
  return Math.round(chf * 100);
}

function parseAmount(raw: string | undefined, fallbackChf: number, label: string): number {
  const chf = raw === undefined ? fallbackChf : Number(raw);
  if (!Number.isFinite(chf) || chf <= 0) {
    throw new Error(`Ungültiger Betrag für ${label}: "${raw}" (erwartet positive Zahl in CHF).`);
  }
  return chfToRappen(chf);
}

/** Premium-Produkt anhand der Metadaten wiederverwenden oder neu anlegen. */
async function ensureProduct(stripe: Stripe): Promise<string> {
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (
      product.metadata?.app === PRODUCT_MARKER.app &&
      product.metadata?.kind === PRODUCT_MARKER.kind
    ) {
      // eslint-disable-next-line no-console
      console.log(`• Produkt wiederverwendet: ${product.id} (${product.name})`);
      return product.id;
    }
  }
  const created = await stripe.products.create({
    name: PRODUCT_NAME,
    description: 'Premium-Funktionen von diginachlass.ch',
    metadata: { ...PRODUCT_MARKER },
  });
  // eslint-disable-next-line no-console
  console.log(`• Produkt erstellt: ${created.id} (${created.name})`);
  return created.id;
}

/** Preis über lookup_key wiederverwenden oder neu anlegen. */
async function ensurePrice(stripe: Stripe, productId: string, plan: PlanDef): Promise<string> {
  const existing = await stripe.prices.list({
    lookup_keys: [plan.lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`• ${plan.nickname}: bestehender Preis ${existing.data[0].id} wiederverwendet.`);
    return existing.data[0].id;
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: CURRENCY,
    unit_amount: plan.amountRappen,
    nickname: plan.nickname,
    lookup_key: plan.lookupKey,
    transfer_lookup_key: true,
    metadata: { app: PRODUCT_MARKER.app },
    ...(plan.recurring ? { recurring: plan.recurring } : {}),
  });
  const kind = plan.recurring ? `/${plan.recurring.interval}` : ' einmalig';
  // eslint-disable-next-line no-console
  console.log(
    `• ${plan.nickname}: neuer Preis ${price.id} ` +
      `(${(plan.amountRappen / 100).toFixed(2)} ${CURRENCY.toUpperCase()}${kind}).`,
  );
  return price.id;
}

async function main(): Promise<void> {
  if (!env.STRIPE_SECRET_KEY) {
    // eslint-disable-next-line no-console
    console.error('STRIPE_SECRET_KEY ist nicht gesetzt. Bitte den Test-Key (sk_test_…) in die .env eintragen.');
    process.exit(1);
  }
  if (!env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    // eslint-disable-next-line no-console
    console.error(
      'Abbruch: STRIPE_SECRET_KEY ist kein Test-Key (sk_test_…). ' +
        'Dieses Skript ist ausschliesslich für den Stripe-Test-Modus gedacht.',
    );
    process.exit(1);
  }

  const plans: PlanDef[] = [
    {
      envVar: 'STRIPE_PRICE_MONTHLY',
      lookupKey: 'dnl_premium_monthly',
      nickname: 'Premium monatlich',
      amountRappen: parseAmount(process.argv[2], 4.9, 'monatlich'),
      recurring: { interval: 'month' },
    },
    {
      envVar: 'STRIPE_PRICE_YEARLY',
      lookupKey: 'dnl_premium_yearly',
      nickname: 'Premium jährlich',
      amountRappen: parseAmount(process.argv[3], 49, 'jährlich'),
      recurring: { interval: 'year' },
    },
    {
      envVar: 'STRIPE_PRICE_LIFETIME',
      lookupKey: 'dnl_premium_lifetime',
      nickname: 'Premium lebenslang',
      amountRappen: parseAmount(process.argv[4], 99, 'lebenslang'),
    },
  ];

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  // eslint-disable-next-line no-console
  console.log('Lege Stripe-Test-Preise an …\n');

  const productId = await ensureProduct(stripe);

  const lines: string[] = [];
  for (const plan of plans) {
    const id = await ensurePrice(stripe, productId, plan);
    lines.push(`${plan.envVar}=${id}`);
  }

  // eslint-disable-next-line no-console
  console.log('\nFertige .env-Zeilen — in deine .env übernehmen:\n');
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
  // eslint-disable-next-line no-console
  console.log('');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fehler beim Anlegen der Stripe-Preise:', err instanceof Error ? err.message : err);
  process.exit(1);
});
