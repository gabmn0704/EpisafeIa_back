import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers';

type App = ReturnType<typeof createTestApp>['app'];

async function addContact(app: App, auth: Record<string, string>, body: object) {
  const res = await request(app).post('/api/v1/contacts').set(auth).send(body);
  expect(res.status).toBe(201);
  return res.body.contact;
}

describe('emergency', () => {
  it('creates the seizure and event, notifying contacts by priority', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    await addContact(app, s.auth, { name: 'Tercero', email: 'c@test.com', priority: 3, notifySms: false });
    await addContact(app, s.auth, { name: 'Primero', phone: '+57 300 111 2222', email: 'a@test.com', priority: 1 });
    await addContact(app, s.auth, { name: 'Segundo', phone: '+57 300 333 4444', priority: 2 });

    const res = await request(app).post('/api/v1/emergency').set(s.auth).send({ latitude: 4.65, longitude: -74.05, note: 'en casa' });
    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({ status: 'notified', latitude: 4.65, longitude: -74.05 });
    expect(res.body.seizure).toMatchObject({ source: 'emergency', notes: 'en casa' });

    const order = res.body.notifications.map((n: { payload: { contactName: string }; channel: string }) => `${n.payload.contactName}:${n.channel}`);
    expect(order).toEqual(['Primero:sms', 'Primero:email', 'Segundo:sms', 'Tercero:email']);
    expect(res.body.notifications.every((n: { status: string }) => n.status === 'sent')).toBe(true);
    expect(res.body.notifications[0].payload.body).toContain('maps.google.com');

    const seizures = await request(app).get('/api/v1/seizures').set(s.auth);
    expect(seizures.body.total).toBe(1);
  });

  it('works without contacts and warns', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const res = await request(app).post('/api/v1/emergency').set(s.auth).send({});
    expect(res.status).toBe(201);
    expect(res.body.event.status).toBe('active');
    expect(res.body.warning).toMatch(/contactos/);
    expect(res.body.notifications).toEqual([]);
  });

  it('marks failed deliveries when the destination is invalid', async () => {
    const { app, ctx } = createTestApp();
    const s = await registerUser(app);
    await ctx.repos.contacts.insert({
      userId: s.userId, name: 'Roto', relationship: null, phone: 'xx', email: null, priority: 1, notifySms: true, notifyEmail: false,
    });
    const res = await request(app).post('/api/v1/emergency').set(s.auth).send({});
    expect(res.body.notifications[0].status).toBe('failed');
    expect(res.body.event.status).toBe('active');
  });

  it('lists active events and resolves them computing duration', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const e = await request(app).post('/api/v1/emergency').set(s.auth).send({});
    const id = e.body.event.id;
    expect((await request(app).get('/api/v1/emergency/active').set(s.auth)).body.events).toHaveLength(1);
    const done = await request(app).post(`/api/v1/emergency/${id}/resolve`).set(s.auth);
    expect(done.body.event.status).toBe('resolved');
    expect((await request(app).get('/api/v1/emergency/active').set(s.auth)).body.events).toHaveLength(0);
    const seizure = await request(app).get(`/api/v1/seizures/${e.body.seizure.id}`).set(s.auth);
    expect(seizure.body.seizure.resolvedAt).toBeTruthy();
    expect(seizure.body.seizure.durationSeconds).toBeGreaterThanOrEqual(0);
    expect((await request(app).post(`/api/v1/emergency/${id}/resolve`).set(s.auth)).status).toBe(409);
  });

  it('false alarm removes the seizure', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const e = await request(app).post('/api/v1/emergency').set(s.auth).send({});
    const res = await request(app).post(`/api/v1/emergency/${e.body.event.id}/false-alarm`).set(s.auth);
    expect(res.body.event).toMatchObject({ status: 'false_alarm', seizureId: null });
    expect((await request(app).get('/api/v1/seizures').set(s.auth)).body.total).toBe(0);
  });

  it('publishes an emergency event on the bus and isolates users', async () => {
    const { app, ctx } = createTestApp();
    const a = await registerUser(app);
    const b = await registerUser(app);
    const seen: string[] = [];
    ctx.bus.subscribe((ev) => seen.push(`${ev.userId}:${ev.name}`));
    const e = await request(app).post('/api/v1/emergency').set(a.auth).send({});
    expect(seen).toEqual([`${a.userId}:emergency`]);
    expect((await request(app).post(`/api/v1/emergency/${e.body.event.id}/resolve`).set(b.auth)).status).toBe(404);
    expect((await request(app).post('/api/v1/emergency').set(a.auth).send({ latitude: 200 })).status).toBe(400);
  });
});
