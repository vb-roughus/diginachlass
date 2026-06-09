import path from 'node:path';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { sessionMiddleware } from './middleware/session';
import { loadUser } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { webhookRouter } from './routes/webhooks';
import { apiRouter } from './routes';

// Projektwurzel — funktioniert sowohl für src/ (tsx) als auch dist/ (build).
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

export function createApp(): Express {
  const app = express();

  if (env.TRUST_PROXY) {
    // Hinter Reverse-Proxy (TLS-Terminierung): erste Proxy-Hop vertrauen.
    app.set('trust proxy', 1);
  }
  app.disable('x-powered-by');

  // Security-Header. CSP erlaubt die nötigen Inline-Styles/-Skripte der
  // bestehenden, selbsttragenden index.html sowie Google Fonts.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'self'"],
          'base-uri': ["'self'"],
          'object-src': ["'none'"],
          'upgrade-insecure-requests': env.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // WICHTIG: Webhook MIT Raw-Body und VOR express.json() / CSRF mounten.
  app.use('/api/webhooks', webhookRouter);

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use(sessionMiddleware);
  app.use(loadUser);

  // --- Statische Seiten ------------------------------------------------------
  // Öffentliche Marketing-Seite (selbsttragend) bleibt an der Wurzel.
  app.get('/', (_req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });
  app.get('/content.json', (_req, res) => {
    res.sendFile(path.join(rootDir, 'content.json'), (err) => {
      // Keine content.json vorhanden -> 404; die Seite nutzt dann ihre Defaults.
      if (err && !res.headersSent) res.status(404).json({ error: 'Nicht gefunden.' });
    });
  });
  // App-Seiten (Login/Registrierung/Konto/Upgrade) + geteilte Assets.
  app.use(express.static(publicDir, { index: false, extensions: ['html'] }));

  // --- API -------------------------------------------------------------------
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
