import { describe, it, expect } from 'vitest';
import { agent, getCsrf, registerVerifyLogin, lastTokenFor } from './helpers';
import { testMailbox, testMailFailure } from '../src/lib/mailer';
import { prisma } from '../src/db/prisma';

describe('Auth & CSRF', () => {
  it('lehnt zustandsändernde Requests ohne CSRF-Token ab (403)', async () => {
    const a = agent();
    await a.get('/api/csrf'); // setzt Session-Cookie + Token
    const res = await a.post('/api/auth/register').send({
      email: 'x@example.com',
      password: 'TestPasswort1',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF');
  });

  it('Registrierung ist nicht-enumerierend (gleiche Antwort, ob neu oder vorhanden)', async () => {
    const a = agent();
    const csrf = await getCsrf(a);
    const email = 'enum@example.com';

    const r1 = await a.post('/api/auth/register').set('x-csrf-token', csrf).send({ email, password: 'TestPasswort1' });
    const r2 = await a.post('/api/auth/register').set('x-csrf-token', csrf).send({ email, password: 'TestPasswort1' });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.message).toBe(r2.body.message);
  });

  it('weist schwache Passwörter mit deutscher Meldung zurück', async () => {
    const a = agent();
    const csrf = await getCsrf(a);
    const res = await a
      .post('/api/auth/register')
      .set('x-csrf-token', csrf)
      .send({ email: 'weak@example.com', password: 'kurz' });
    expect(res.status).toBe(400);
    expect(res.body.fields.some((f: { message: string }) => /Zeichen/.test(f.message))).toBe(true);
  });

  it('voller Flow: registrieren -> verifizieren -> anmelden -> Konto', async () => {
    const a = agent();
    const user = await registerVerifyLogin(a, 'flow@example.com');
    const res = await a.get('/api/account').expect(200);
    expect(res.body.user.email).toBe('flow@example.com');
    expect(res.body.user.emailVerified).toBe(true);
    expect(res.body.entitlement.premium).toBe(false);
    expect(user.email).toBe('flow@example.com');
  });

  it('falsches Passwort => 401, generische Meldung', async () => {
    const a = agent();
    await registerVerifyLogin(a, 'pw@example.com', 'TestPasswort1');
    const csrf = await getCsrf(a);
    const res = await a
      .post('/api/auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'pw@example.com', password: 'FalschesPasswort9' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/E-Mail oder Passwort/);
  });

  it('sperrt nach mehreren Fehlversuchen (429)', async () => {
    const a = agent();
    await registerVerifyLogin(a, 'lock@example.com', 'TestPasswort1');
    const csrf = await getCsrf(a);
    let status = 0;
    for (let i = 0; i < 6; i++) {
      const res = await a
        .post('/api/auth/login')
        .set('x-csrf-token', csrf)
        .send({ email: 'lock@example.com', password: 'Falsch123456' });
      status = res.status;
    }
    expect(status).toBe(429);
  });

  it('Passwort-Reset: anfordern -> bestätigen -> mit neuem Passwort anmelden', async () => {
    const a = agent();
    await registerVerifyLogin(a, 'reset@example.com', 'TestPasswort1');
    // ausloggen
    let csrf = await getCsrf(a);
    await a.post('/api/auth/logout').set('x-csrf-token', csrf).expect(200);

    csrf = await getCsrf(a);
    await a
      .post('/api/auth/password-reset/request')
      .set('x-csrf-token', csrf)
      .send({ email: 'reset@example.com' })
      .expect(200);

    const token = lastTokenFor('reset');
    expect(token).toBeTruthy();

    await a
      .post('/api/auth/password-reset/confirm')
      .set('x-csrf-token', csrf)
      .send({ token, password: 'NeuesPasswort2' })
      .expect(200);

    csrf = await getCsrf(a);
    await a
      .post('/api/auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'reset@example.com', password: 'NeuesPasswort2' })
      .expect(200);
  });

  it('Verifizierungs-E-Mail wird versendet', async () => {
    const a = agent();
    const csrf = await getCsrf(a);
    await a.post('/api/auth/register').set('x-csrf-token', csrf).send({ email: 'mail@example.com', password: 'TestPasswort1' });
    expect(testMailbox.some((m) => /bestätigen/i.test(m.subject))).toBe(true);
  });
});

describe('Premium-Gating (serverseitig)', () => {
  it('Free-Nutzer erhält 402 auf Premium-Endpunkten', async () => {
    const a = agent();
    await registerVerifyLogin(a, 'free@example.com');

    const comp = await a.get('/api/compendium');
    expect(comp.status).toBe(402);
    expect(comp.body.code).toBe('PREMIUM_ERFORDERLICH');

    const trusted = await a.get('/api/trusted-persons');
    expect(trusted.status).toBe(402);
  });

  it('Free-Nutzer kann Dienste (Metadaten) anlegen und Vorschau sehen', async () => {
    const a = agent();
    const user = await registerVerifyLogin(a, 'svc@example.com');

    const create = await a
      .post('/api/accounts')
      .set('x-csrf-token', user.csrf)
      .send({ serviceName: 'Google / Gmail', category: 'kommunikation', relevance: 'hoch', accessDocumented: 'nein' });
    expect(create.status).toBe(201);

    const preview = await a.get('/api/compendium/preview').expect(200);
    expect(preview.body.total).toBe(1);
    expect(preview.body.highRelevance).toBe(1);
  });

  it('Premium-Nutzer (manuell gesetzt) erhält Zugriff auf volles Compendium', async () => {
    const a = agent();
    await registerVerifyLogin(a, 'prem@example.com');
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'prem@example.com' } });
    await prisma.entitlement.update({
      where: { userId: u.id },
      data: { plan: 'premium', type: 'lifetime', status: 'active' },
    });

    const comp = await a.get('/api/compendium').expect(200);
    expect(comp.body.plan).toBe('premium');
    expect(comp.body).toHaveProperty('completeness');
    expect(comp.body).toHaveProperty('risks');
  });
});

describe('DSG/DSGVO', () => {
  it('Datenexport liefert JSON mit Konto- und Dienstdaten', async () => {
    const a = agent();
    const user = await registerVerifyLogin(a, 'export@example.com');
    await a
      .post('/api/accounts')
      .set('x-csrf-token', user.csrf)
      .send({ serviceName: 'Dropbox', category: 'cloud' });

    const res = await a.get('/api/account/export').expect(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const data = JSON.parse(res.text);
    expect(data.konto.email).toBe('export@example.com');
    expect(data.dienste.length).toBe(1);
    // Sensible Felder dürfen NICHT exportiert werden.
    expect(JSON.stringify(data)).not.toMatch(/passwordHash/);
  });

  it('Kontolöschung entfernt Nutzer und kaskadierende Daten', async () => {
    const a = agent();
    const user = await registerVerifyLogin(a, 'del@example.com');
    await a
      .post('/api/accounts')
      .set('x-csrf-token', user.csrf)
      .send({ serviceName: 'Spotify', category: 'unterhaltung' });

    await a
      .delete('/api/account')
      .set('x-csrf-token', user.csrf)
      .send({ password: user.password, confirm: 'LÖSCHEN' })
      .expect(200);

    const gone = await prisma.user.findUnique({ where: { email: 'del@example.com' } });
    expect(gone).toBeNull();
    const accounts = await prisma.nachlassAccount.count();
    expect(accounts).toBe(0);
  });
});

describe('Mailversand-Ausfälle', () => {
  it('Registrierung bleibt erfolgreich, wenn der Mailversand scheitert', async () => {
    const a = agent();
    const csrf = await getCsrf(a);
    const email = 'mailfail@example.com';

    testMailFailure.enabled = true;
    try {
      const res = await a
        .post('/api/auth/register')
        .set('x-csrf-token', csrf)
        .send({ email, password: 'TestPasswort1' });
      expect(res.status).toBe(200);
    } finally {
      testMailFailure.enabled = false;
    }

    // Konto wurde trotz fehlgeschlagener Mail angelegt (vorher: HTTP 500).
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
  });

  it('erneute Registrierung derselben Adresse bleibt generisch (keine Sackgasse)', async () => {
    const a = agent();
    const csrf = await getCsrf(a);
    const email = 'mailfail2@example.com';

    testMailFailure.enabled = true;
    try {
      const r1 = await a
        .post('/api/auth/register')
        .set('x-csrf-token', csrf)
        .send({ email, password: 'TestPasswort1' });
      const r2 = await a
        .post('/api/auth/register')
        .set('x-csrf-token', csrf)
        .send({ email, password: 'TestPasswort1' });
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r1.body.message).toBe(r2.body.message);
    } finally {
      testMailFailure.enabled = false;
    }
  });

  it('Passwort-Reset-Anfrage bleibt generisch, wenn der Mailversand scheitert', async () => {
    const a = agent();
    const user = await registerVerifyLogin(a, 'mailfail3@example.com');

    testMailFailure.enabled = true;
    try {
      const res = await a
        .post('/api/auth/password-reset/request')
        .set('x-csrf-token', user.csrf)
        .send({ email: user.email });
      expect(res.status).toBe(200);
    } finally {
      testMailFailure.enabled = false;
    }
  });
});
