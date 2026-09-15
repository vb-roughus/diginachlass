import { describe, it, expect } from 'vitest';
import { agent, getCsrf, registerVerifyLogin, type Agent } from './helpers';
import { prisma } from '../src/db/prisma';

/** Registriert einen Nutzer, stuft ihn zum Admin hoch und meldet ihn an. */
async function adminAgent(email: string): Promise<{ a: Agent; csrf: string }> {
  const a = agent();
  const user = await registerVerifyLogin(a, email);
  // Die Rolle wird pro Request frisch geladen -> wirkt sofort, ohne Neuanmeldung.
  await prisma.user.update({ where: { email }, data: { role: 'admin' } });
  return { a, csrf: user.csrf };
}

const names = (body: { items: Array<{ name: string }> }): string[] => body.items.map((i) => i.name);

describe('Dienst-Katalog', () => {
  it('erfordert für die Auswahlliste eine Anmeldung', async () => {
    const res = await agent().get('/api/services');
    expect(res.status).toBe(401);
  });

  it('verwehrt normalen Nutzenden die Katalogpflege (403)', async () => {
    const a = agent();
    const user = await registerVerifyLogin(a, 'normal@example.com');
    const res = await a
      .post('/api/admin/services')
      .set('x-csrf-token', user.csrf)
      .send({ name: 'Heimlich', category: 'sonstiges' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('KEIN_ADMIN');
  });

  it('Admin legt einen Dienst an — Nutzende sehen ihn in der Auswahl', async () => {
    const { a, csrf } = await adminAgent('admin1@example.com');
    const created = await a
      .post('/api/admin/services')
      .set('x-csrf-token', csrf)
      .send({ name: 'Testdienst', category: 'cloud' });
    expect(created.status).toBe(201);

    const u = agent();
    await registerVerifyLogin(u, 'kunde1@example.com');
    const list = await u.get('/api/services');
    expect(list.status).toBe(200);
    expect(names(list.body)).toContain('Testdienst');
  });

  it('lehnt doppelte Namen ab (409)', async () => {
    const { a, csrf } = await adminAgent('admin2@example.com');
    await a
      .post('/api/admin/services')
      .set('x-csrf-token', csrf)
      .send({ name: 'Doppelt', category: 'cloud' })
      .expect(201);

    const res = await a
      .post('/api/admin/services')
      .set('x-csrf-token', csrf)
      .send({ name: 'Doppelt', category: 'finanzen' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DIENST_EXISTIERT');
  });

  it('blendet inaktive Dienste für Nutzende aus, zeigt sie dem Admin aber an', async () => {
    const { a, csrf } = await adminAgent('admin3@example.com');
    await a
      .post('/api/admin/services')
      .set('x-csrf-token', csrf)
      .send({ name: 'Versteckt', category: 'sonstiges', active: false })
      .expect(201);

    const adminList = await a.get('/api/admin/services');
    expect(names(adminList.body)).toContain('Versteckt');

    const u = agent();
    await registerVerifyLogin(u, 'kunde2@example.com');
    const list = await u.get('/api/services');
    expect(names(list.body)).not.toContain('Versteckt');
  });

  it('ändert und löscht einen Dienst', async () => {
    const { a, csrf } = await adminAgent('admin4@example.com');
    const created = await a
      .post('/api/admin/services')
      .set('x-csrf-token', csrf)
      .send({ name: 'Weg damit', category: 'cloud' });
    const id = created.body.item.id as string;

    const patched = await a
      .patch('/api/admin/services/' + id)
      .set('x-csrf-token', csrf)
      .send({ name: 'Umbenannt' });
    expect(patched.status).toBe(200);
    expect(patched.body.item.name).toBe('Umbenannt');

    await a.delete('/api/admin/services/' + id).set('x-csrf-token', csrf).expect(204);
    const after = await a.get('/api/admin/services');
    expect(names(after.body)).not.toContain('Umbenannt');
  });
});

describe('Kompendium', () => {
  /** Legt einen Katalog-Dienst an und gibt dessen Id zurück. */
  async function makeService(a: Agent, csrf: string, name: string): Promise<string> {
    const res = await a
      .post('/api/admin/services')
      .set('x-csrf-token', csrf)
      .send({ name, category: 'cloud' })
      .expect(201);
    return res.body.item.id as string;
  }

  const payload = {
    contactPoint: 'Angehörige wenden sich an den Support.',
    steps: ['Todesfall melden', 'Sterbeurkunde einreichen'],
    links: [{ label: 'Offizielle Hilfe', url: 'https://example.com/hilfe' }],
    note: 'Bearbeitung dauert einige Wochen.',
  };

  it('verwehrt normalen Nutzenden den Zugriff (403)', async () => {
    const a = agent();
    const user = await registerVerifyLogin(a, 'normal-komp@example.com');
    const res = await a
      .put('/api/admin/compendium/irgendeine-id')
      .set('x-csrf-token', user.csrf)
      .send(payload);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('KEIN_ADMIN');
  });

  it('legt einen Eintrag an und gibt ihn wieder aus', async () => {
    const { a, csrf } = await adminAgent('komp1@example.com');
    const id = await makeService(a, csrf, 'Dienst mit Eintrag');

    const missing = await a.get('/api/admin/compendium/' + id);
    expect(missing.status).toBe(404);

    const put = await a.put('/api/admin/compendium/' + id).set('x-csrf-token', csrf).send(payload);
    expect(put.status).toBe(200);

    const got = await a.get('/api/admin/compendium/' + id);
    expect(got.status).toBe(200);
    expect(got.body.item.contactPoint).toBe(payload.contactPoint);
    expect(got.body.item.steps).toEqual(payload.steps);
    expect(got.body.item.links).toEqual(payload.links);
    expect(got.body.item.service.name).toBe('Dienst mit Eintrag');
  });

  it('aktualisiert einen bestehenden Eintrag, statt einen zweiten anzulegen', async () => {
    const { a, csrf } = await adminAgent('komp2@example.com');
    const id = await makeService(a, csrf, 'Dienst doppelt gepflegt');

    await a.put('/api/admin/compendium/' + id).set('x-csrf-token', csrf).send(payload).expect(200);
    await a
      .put('/api/admin/compendium/' + id)
      .set('x-csrf-token', csrf)
      .send({ ...payload, contactPoint: 'Neue Anlaufstelle.' })
      .expect(200);

    const list = await a.get('/api/admin/compendium');
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].contactPoint).toBe('Neue Anlaufstelle.');
  });

  it('lehnt ungültige Links ab (400)', async () => {
    const { a, csrf } = await adminAgent('komp3@example.com');
    const id = await makeService(a, csrf, 'Dienst mit kaputtem Link');
    const res = await a
      .put('/api/admin/compendium/' + id)
      .set('x-csrf-token', csrf)
      .send({ ...payload, links: [{ label: 'Kaputt', url: 'kein-link' }] });
    expect(res.status).toBe(400);
  });

  it('weist den Pflegestand in der Dienstliste aus', async () => {
    const { a, csrf } = await adminAgent('komp4@example.com');
    const gepflegt = await makeService(a, csrf, 'Gepflegt');
    await makeService(a, csrf, 'Offen');
    await a.put('/api/admin/compendium/' + gepflegt).set('x-csrf-token', csrf).send(payload).expect(200);

    const list = await a.get('/api/admin/services');
    const byName: Record<string, { compendium: unknown }> = {};
    for (const i of list.body.items) byName[i.name] = i;
    expect(byName['Gepflegt'].compendium).not.toBeNull();
    expect(byName['Offen'].compendium).toBeNull();
  });

  it('entfernt den Eintrag mit dem Dienst (Kaskade)', async () => {
    const { a, csrf } = await adminAgent('komp5@example.com');
    const id = await makeService(a, csrf, 'Dienst wird gelöscht');
    await a.put('/api/admin/compendium/' + id).set('x-csrf-token', csrf).send(payload).expect(200);

    await a.delete('/api/admin/services/' + id).set('x-csrf-token', csrf).expect(204);

    const list = await a.get('/api/admin/compendium');
    expect(list.body.items).toHaveLength(0);
  });

  it('löscht einen Eintrag einzeln, ohne den Dienst zu entfernen', async () => {
    const { a, csrf } = await adminAgent('komp6@example.com');
    const id = await makeService(a, csrf, 'Dienst bleibt');
    await a.put('/api/admin/compendium/' + id).set('x-csrf-token', csrf).send(payload).expect(200);

    await a.delete('/api/admin/compendium/' + id).set('x-csrf-token', csrf).expect(204);
    expect((await a.get('/api/admin/compendium/' + id)).status).toBe(404);

    const services = await a.get('/api/admin/services');
    expect(names(services.body)).toContain('Dienst bleibt');
  });
});

describe('Entitlement zurücksetzen (Admin)', () => {
  it('verwehrt normalen Nutzenden den Zugriff (403)', async () => {
    const a = agent();
    const user = await registerVerifyLogin(a, 'normal-reset@example.com');
    const me = await prisma.user.findUniqueOrThrow({ where: { email: 'normal-reset@example.com' } });
    const res = await a
      .post('/api/admin/users/' + me.id + '/entitlement/reset')
      .set('x-csrf-token', user.csrf);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('KEIN_ADMIN');
  });

  it('meldet einen unbekannten Nutzer mit 404', async () => {
    const { a, csrf } = await adminAgent('reset-admin1@example.com');
    const res = await a.post('/api/admin/users/gibtesnicht/entitlement/reset').set('x-csrf-token', csrf);
    expect(res.status).toBe(404);
  });

  it('stuft ein Premium-Konto auf free zurück und protokolliert das', async () => {
    const { a, csrf } = await adminAgent('reset-admin2@example.com');

    // Zielkonto anlegen und künstlich auf Premium setzen.
    const b = agent();
    await registerVerifyLogin(b, 'premium-kunde@example.com');
    const target = await prisma.user.findUniqueOrThrow({ where: { email: 'premium-kunde@example.com' } });
    await prisma.entitlement.update({
      where: { userId: target.id },
      data: {
        plan: 'premium',
        type: 'subscription',
        status: 'active',
        validUntil: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: true,
        stripeSubscriptionId: 'sub_test123',
      },
    });

    const res = await a
      .post('/api/admin/users/' + target.id + '/entitlement/reset')
      .set('x-csrf-token', csrf);
    expect(res.status).toBe(200);

    const after = await prisma.entitlement.findUniqueOrThrow({ where: { userId: target.id } });
    expect(after.plan).toBe('free');
    expect(after.type).toBeNull();
    expect(after.status).toBe('none');
    expect(after.validUntil).toBeNull();
    expect(after.cancelAtPeriodEnd).toBe(false);
    expect(after.stripeSubscriptionId).toBeNull();

    const events = await prisma.securityEvent.findMany({
      where: { userId: target.id, type: 'entitlement_reset_by_admin' },
    });
    expect(events).toHaveLength(1);
  });
});

describe('Benutzerverwaltung (Admin)', () => {
  it('befördert einen Nutzer zum Administrator und wieder zurück', async () => {
    const { a, csrf } = await adminAgent('rollen-admin@example.com');
    const b = agent();
    await registerVerifyLogin(b, 'kandidat@example.com');
    const target = await prisma.user.findUniqueOrThrow({ where: { email: 'kandidat@example.com' } });
    expect(target.role).toBe('user');

    const up = await a
      .patch('/api/admin/users/' + target.id + '/role')
      .set('x-csrf-token', csrf)
      .send({ role: 'admin' });
    expect(up.status).toBe(200);
    expect(up.body.user.role).toBe('admin');

    const down = await a
      .patch('/api/admin/users/' + target.id + '/role')
      .set('x-csrf-token', csrf)
      .send({ role: 'user' });
    expect(down.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe('user');

    const events = await prisma.securityEvent.findMany({
      where: { userId: target.id, type: 'role_changed_by_admin' },
    });
    expect(events).toHaveLength(2);
  });

  it('verhindert das Ändern der eigenen Rolle', async () => {
    const { a, csrf } = await adminAgent('selbst@example.com');
    const me = await prisma.user.findUniqueOrThrow({ where: { email: 'selbst@example.com' } });
    const res = await a
      .patch('/api/admin/users/' + me.id + '/role')
      .set('x-csrf-token', csrf)
      .send({ role: 'user' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EIGENE_ROLLE');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).role).toBe('admin');
  });

  it('lehnt eine unbekannte Rolle ab (400)', async () => {
    const { a, csrf } = await adminAgent('rollen-admin2@example.com');
    const b = agent();
    await registerVerifyLogin(b, 'kandidat2@example.com');
    const target = await prisma.user.findUniqueOrThrow({ where: { email: 'kandidat2@example.com' } });
    const res = await a
      .patch('/api/admin/users/' + target.id + '/role')
      .set('x-csrf-token', csrf)
      .send({ role: 'superuser' });
    expect(res.status).toBe(400);
  });

  it('gewährt Premium manuell als unbefristete Berechtigung', async () => {
    const { a, csrf } = await adminAgent('grant-admin@example.com');
    const b = agent();
    await registerVerifyLogin(b, 'beschenkt@example.com');
    const target = await prisma.user.findUniqueOrThrow({ where: { email: 'beschenkt@example.com' } });

    const res = await a
      .post('/api/admin/users/' + target.id + '/entitlement/grant')
      .set('x-csrf-token', csrf);
    expect(res.status).toBe(200);

    const ent = await prisma.entitlement.findUniqueOrThrow({ where: { userId: target.id } });
    expect(ent.plan).toBe('premium');
    expect(ent.type).toBe('lifetime');
    expect(ent.status).toBe('active');
    expect(ent.validUntil).toBeNull();

    const events = await prisma.securityEvent.findMany({
      where: { userId: target.id, type: 'entitlement_granted_by_admin' },
    });
    expect(events).toHaveLength(1);
  });

  it('verwehrt normalen Nutzenden beide Aktionen (403)', async () => {
    const a = agent();
    const user = await registerVerifyLogin(a, 'normal-aktionen@example.com');
    const me = await prisma.user.findUniqueOrThrow({ where: { email: 'normal-aktionen@example.com' } });

    const r1 = await a.patch('/api/admin/users/' + me.id + '/role').set('x-csrf-token', user.csrf).send({ role: 'admin' });
    const r2 = await a.post('/api/admin/users/' + me.id + '/entitlement/grant').set('x-csrf-token', user.csrf);
    expect(r1.status).toBe(403);
    expect(r2.status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).role).toBe('user');
  });
});
