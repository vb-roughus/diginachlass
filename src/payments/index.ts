import type { PaymentProvider } from './PaymentProvider';
import { StripeProvider } from './StripeProvider';

/**
 * Provider-Factory. Aktuell ausschliesslich Stripe. Ein Wechsel auf einen
 * anderen PSP erfolgt durch Austausch dieser einen Stelle.
 */
let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    provider = new StripeProvider();
  }
  return provider;
}

export type { PaymentProvider } from './PaymentProvider';
