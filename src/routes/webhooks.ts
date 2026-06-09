import { Router, raw } from 'express';
import { asyncHandler, AppError } from '../middleware/error';
import { getPaymentProvider } from '../payments';
import { logger } from '../lib/logger';

/**
 * Stripe-Webhook. WICHTIG: Diese Route MUSS den Raw-Body erhalten (kein
 * JSON-Parsing davor), damit die Signaturprüfung (constructEvent) funktioniert.
 * Sie wird vor der globalen JSON-/CSRF-Middleware gemountet und ist bewusst
 * NICHT durch CSRF geschützt (Schutz erfolgt über die Signatur).
 */
export const webhookRouter = Router();

webhookRouter.post(
  '/stripe',
  raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const signature = req.get('stripe-signature');
    if (!signature) {
      throw new AppError(400, 'Fehlende Stripe-Signatur.');
    }
    const provider = getPaymentProvider();
    // req.body ist hier ein Buffer (raw).
    const result = await provider.handleWebhook(req.body as Buffer, signature);
    logger.info('stripe_webhook_handled', { type: result.type });
    res.json({ received: true });
  }),
);
