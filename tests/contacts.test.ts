import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers';

const contact = { name: 'Mamá', relationship: 'madre', phone: '+57 300 123 4567', email: 'mama@test.com', priority: 1 };

describe('contacts', () => {
  it('requires authentication', async () => {
    const { app } = createTestApp();
    expect((await request(app).get('/api/v1/contacts')).status).toBe(401);
  });

  it('creates, lists ordered by priority, updates and deletes', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const a = await request(app).post('/api/v1/contacts').set(s.auth).send({ ...contact, name: 'B', priority: 2 });
    expect(a.status).toBe(201);
    await request(app).post('/api/v1/contacts').set(s.auth).send({ ...contact, name: 'A', priority: 1 });
    const list = await request(app).get('/api/v1/contacts').set(s.auth);
    expect(list.body.contacts.map((c: { name: string }) => c.name)).toEqual(['A', 'B']);

    const up = await request(app).put(`/api/v1/contacts/${a.body.contact.id}`).set(s.auth).send({ priority: 5 });
    expect(up.status).toBe(200);
    expect(up.body.contact.priority).toBe(5);

    const del = await request(app).delete(`/api/v1/contacts/${a.body.contact.id}`).set(s.auth);
    expect(del.status).toBe(204);
    expect((await request(app).get('/api/v1/contacts').set(s.auth)).body.contacts).toHaveLength(1);
  });

  it('requires a phone or an email and validates formats', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const none = await request(app).post('/api/v1/contacts').set(s.auth).send({ name: 'X' });
    expect(none.status).toBe(400);
    const badPhone = await request(app).post('/api/v1/contacts').set(s.auth).send({ name: 'X', phone: 'abc' });
    expect(badPhone.status).toBe(400);
  });

  it('does not expose contacts across users', async () => {
    const { app } = createTestApp();
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const c = await request(app).post('/api/v1/contacts').set(owner.auth).send(contact);
    expect((await request(app).put(`/api/v1/contacts/${c.body.contact.id}`).set(other.auth).send({ name: 'hack' })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/contacts/${c.body.contact.id}`).set(other.auth)).status).toBe(404);
    expect((await request(app).get('/api/v1/contacts').set(other.auth)).body.contacts).toHaveLength(0);
  });

  it('rejects malformed ids', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    expect((await request(app).delete('/api/v1/contacts/not-a-uuid').set(s.auth)).status).toBe(400);
  });
});
