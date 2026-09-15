import { Router } from 'express';
import { ensureCsrfToken, csrfProtection } from '../middleware/csrf';
import { apiLimiter } from '../middleware/rateLimit';
import { authRouter } from './auth';
import { accountRouter } from './account';
import { nachlassAccountsRouter } from './nachlassAccounts';
import { trustedPersonsRouter } from './trustedPersons';
import { compendiumRouter } from './compendium';
import { servicesRouter } from './services';
import { analysisRouter } from './analysis';
import { billingRouter } from './billing';
import { adminRouter } from './admin';
import { env } from '../config/env';

/**
 * Aggregierter API-Router. Die Stripe-Webhook-Route wird NICHT hier, sondern
 * separat mit Raw-Body vor der JSON-/CSRF-Middleware gemountet.
 */
export const apiRouter = Router();

apiRouter.use(apiLimiter);
// CSRF-Schutz für alle zustandsändernden API-Requests (ausser Webhook).
apiRouter.use(csrfProtection);

// Token-Ausgabe für das Frontend.
apiRouter.get('/csrf', (req, res) => {
  res.json({ csrfToken: ensureCsrfToken(req) });
});

// Health-Check (für Monitoring/Deploy).
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', stripeConfigured: env.stripeConfigured, smtpConfigured: env.smtpConfigured });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/account', accountRouter);
apiRouter.use('/accounts', nachlassAccountsRouter);
apiRouter.use('/trusted-persons', trustedPersonsRouter);
apiRouter.use('/compendium', compendiumRouter);
apiRouter.use('/services', servicesRouter);
apiRouter.use('/analysis', analysisRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/admin', adminRouter);
