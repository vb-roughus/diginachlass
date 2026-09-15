import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'mysql://dnl:dnl@127.0.0.1:3306/diginachlass_test';

export default defineConfig({
  test: {
    // ENV wird vor allen Imports gesetzt, damit src/config/env.ts korrekt lädt.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      APP_BASE_URL: 'http://localhost:3000',
      SESSION_SECRET: 'test-session-secret-0123456789abcdef',
      ENCRYPTION_KEY: 'test-encryption-key-0123456789abcdef',
      STRIPE_SECRET_KEY: 'sk_test_dummy',
      STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
      STRIPE_PRICE_MONTHLY: 'price_monthly',
      STRIPE_PRICE_YEARLY: 'price_yearly',
      STRIPE_PRICE_LIFETIME: 'price_lifetime',
    },
    globalSetup: ['tests/globalSetup.ts'],
    setupFiles: ['tests/setup.ts'],
    // Sequenziell ausführen — geteilte Test-DB ohne Race-Conditions.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
