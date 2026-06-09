import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('server_started', {
    port: env.PORT,
    env: env.NODE_ENV,
    baseUrl: env.APP_BASE_URL,
    stripe: env.stripeConfigured,
    smtp: env.smtpConfigured,
  });
  if (!env.isTest) {
    // eslint-disable-next-line no-console
    console.log(`diginachlass.ch läuft auf http://localhost:${env.PORT}`);
  }
});

function shutdown(signal: string): void {
  logger.info('server_shutdown', { signal });
  server.close(() => process.exit(0));
  // Notbremse, falls Verbindungen hängen.
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
