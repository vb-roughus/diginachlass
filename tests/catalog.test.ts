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
