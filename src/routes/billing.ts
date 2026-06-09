import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { validateBody } from '../middleware/validate';
import { requireAuth, requireVerified } from '../middleware/auth';
import { checkoutSchema } from '../validation/schemas';
import { getPaymentProvider } from '../payments';

/**
 * Billing-Endpunkte. Der Kauf erfordert eine verifizierte E-Mail
 * (Verifizierung vor Premium-Kauf). Bestätigt wird ein Kauf ausschliesslich
 * serverseitig per Webhook — niemals über den Erfolgs-Redirect.
 */
export const billingRouter = Router();

billingRouter.post(
  '/checkout',
  requireVerified,
  validateBody(checkoutSchema),
  asyncHandler(async (req, res) => {
    const provider = getPaymentProvider();
    const result = await provider.createCheckout({
      userId: req.user!.id,
      email: req.user!.email,
      interval: req.body.interval,
    });
    res.json({ url: result.url, sessionId: result.sessionId });
  }),
);

billingRouter.post(
  '/portal',
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = getPaymentProvider();
    const result = await provider.createPortalSession({ userId: req.user!.id });
    res.json({ url: result.url });
  }),
);

billingRouter.post(
  '/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = getPaymentProvider();
    await provider.cancelSubscriptionForUser(req.user!.id);
    res.json({
      message:
        'Ihr Abonnement wird zum Ende der laufenden Periode gekündigt. Bis dahin bleibt Premium aktiv.',
    });
  }),
);

billingRouter.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = getPaymentProvider();
    const status = await provider.getStatus(req.user!.id);
    res.json({ ...status, providerConfigured: provider.isConfigured() });
  }),
);
