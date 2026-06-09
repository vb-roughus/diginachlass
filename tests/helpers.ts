import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { testMailbox } from '../src/lib/mailer';

export const app: Express = createApp();

export type Agent = ReturnType<typeof request.agent>;

export function agent(): Agent {
  return request.agent(app);
}

export async function getCsrf(a: Agent): Promise<string> {
  const res = await a.get('/api/csrf');
  return res.body.csrfToken as string;
}

/** Extrahiert das Verifizierungs-Token aus der zuletzt versendeten E-Mail. */
export function lastTokenFor(kind: 'verify' | 'reset'): string | null {
  const needle = kind === 'verify' ? 'verify-email.html?token=' : 'reset-password.html?token=';
  for (let i = testMailbox.length - 1; i >= 0; i--) {
    const m = testMailbox[i].text;
    const idx = m.indexOf(needle);
    if (idx !== -1) {
      const rest = m.slice(idx + needle.length);
      return rest.split(/[\s\n]/)[0];
    }
  }
  return null;
}

export interface TestUser {
  email: string;
  password: string;
  csrf: string;
}

/** Registriert, verifiziert und meldet einen Nutzer an. Gibt den eingeloggten Agent zurück. */
export async function registerVerifyLogin(
  a: Agent,
  email: string,
  password = 'TestPasswort1',
): Promise<TestUser> {
  let csrf = await getCsrf(a);
  await a
    .post('/api/auth/register')
    .set('x-csrf-token', csrf)
    .send({ email, password })
    .expect(200);

  const token = lastTokenFor('verify');
  if (!token) throw new Error('Kein Verifizierungs-Token in der Mailbox');

  await a
    .post('/api/auth/verify-email')
    .set('x-csrf-token', csrf)
    .send({ token })
    .expect(200);

  await a
    .post('/api/auth/login')
    .set('x-csrf-token', csrf)
    .send({ email, password })
    .expect(200);

  // Session wurde regeneriert -> CSRF-Token neu holen.
  csrf = await getCsrf(a);
  return { email, password, csrf };
}
