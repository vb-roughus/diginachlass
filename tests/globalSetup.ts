import { execSync } from 'node:child_process';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'mysql://dnl:dnl@127.0.0.1:3306/diginachlass_test';

/**
 * Einmaliges Setup: Migrationen auf die Test-DB anwenden.
 */
export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
