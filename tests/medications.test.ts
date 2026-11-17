import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers';

const med = { name: 'Levetiracetam', dose: '500', unit: 'mg', scheduleTimes: ['20:00', '08:00', '08:00'] };

describe('medications', () => {
  it('creates with sorted unique schedule times, lists, updates, deletes', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const c = await request(app).post('/api/v1/medications').set(s.auth).send(med);
    expect(c.status).toBe(201);
    expect(c.body.medication.scheduleTimes).toEqual(['08:00', '20:00']);
    const id = c.body.medication.id;
    const up = await request(app).put(`/api/v1/medications/${id}`).set(s.auth).send({ dose: '1000' });
    expect(up.body.medication.dose).toBe('1000');
    expect((await request(app).get('/api/v1/medications').set(s.auth)).body.medications).toHaveLength(1);
    expect((await request(app).delete(`/api/v1/medications/${id}`).set(s.auth)).status).toBe(204);
    expect((await request(app).get('/api/v1/medications').set(s.auth)).body.medications).toHaveLength(0);
  });

  it('validates schedule time format', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const res = await request(app).post('/api/v1/medications').set(s.auth).send({ name: 'X', scheduleTimes: ['25:00'] });
    expect(res.status).toBe(400);
  });

  it('autocompletes with the trie, including the user medications', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const base = await request(app).get('/api/v1/medications/search?q=lev').set(s.auth);
    expect(base.body.results).toEqual(['Levetiracetam']);
    const acid = await request(app).get('/api/v1/medications/search?q=acido').set(s.auth);
    expect(acid.body.results).toContain('Ácido valproico');
    await request(app).post('/api/v1/medications').set(s.auth).send({ name: 'Levomepromazina' });
    const after = await request(app).get('/api/v1/medications/search?q=lev').set(s.auth);
    expect(after.body.results).toEqual(['Levetiracetam', 'Levomepromazina']);
    expect((await request(app).get('/api/v1/medications/search').set(s.auth)).status).toBe(400);
  });

  it('builds today schedule and records doses', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const m = await request(app).post('/api/v1/medications').set(s.auth).send({ name: 'Lamotrigina', scheduleTimes: ['08:00', '20:00'] });
    const today = await request(app).get('/api/v1/medications/schedule/today').set(s.auth);
    expect(today.body.doses).toHaveLength(2);
    expect(today.body.doses[0].status).toBe('pending');

    const first = today.body.doses[0];
    const log = await request(app)
      .post('/api/v1/medications/logs')
      .set(s.auth)
      .send({ medicationId: m.body.medication.id, scheduledFor: first.scheduledFor, status: 'taken' });
    expect(log.status).toBe(201);
    expect(log.body.log.takenAt).toBeTruthy();

    const again = await request(app).get('/api/v1/medications/schedule/today').set(s.auth);
    expect(again.body.doses[0]).toMatchObject({ status: 'taken', logId: log.body.log.id });

    // Re-registrar la misma dosis actualiza, no duplica.
    await request(app)
      .post('/api/v1/medications/logs')
      .set(s.auth)
      .send({ medicationId: m.body.medication.id, scheduledFor: first.scheduledFor, status: 'skipped' });
    const after = await request(app).get('/api/v1/medications/schedule/today').set(s.auth);
    expect(after.body.doses[0].status).toBe('skipped');
  });

  it('computes adherence', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const m = await request(app).post('/api/v1/medications').set(s.auth).send({ name: 'Valproato', scheduleTimes: ['08:00'] });
    const id = m.body.medication.id;
    const day = (n: number) => new Date(Date.now() - n * 86_400_000 - 3 * 3_600_000).toISOString();
    for (const [n, st] of [[1, 'taken'], [2, 'taken'], [3, 'missed'], [4, 'taken']] as const) {
      await request(app).post('/api/v1/medications/logs').set(s.auth).send({ medicationId: id, scheduledFor: day(n), status: st });
    }
    const res = await request(app).get('/api/v1/medications/adherence?days=30').set(s.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ taken: 3, missed: 1, total: 4, rate: 0.75 });
    expect(res.body.streakDays).toBe(2);
    expect(res.body.perMedication[0]).toMatchObject({ name: 'Valproato', taken: 3, total: 4 });
  });

  it('rejects logging doses for foreign medications', async () => {
    const { app } = createTestApp();
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const m = await request(app).post('/api/v1/medications').set(owner.auth).send({ name: 'X' });
    const res = await request(app)
      .post('/api/v1/medications/logs')
      .set(other.auth)
      .send({ medicationId: m.body.medication.id, scheduledFor: new Date().toISOString(), status: 'taken' });
    expect(res.status).toBe(404);
  });
});
