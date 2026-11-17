import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers';

type App = ReturnType<typeof createTestApp>['app'];

const create = (app: App, auth: Record<string, string>, body: object) =>
  request(app).post('/api/v1/seizures').set(auth).send(body);

describe('seizures', () => {
  it('creates and validates', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const ok = await create(app, s.auth, { startedAt: '2024-05-01T10:00:00Z', durationSeconds: 90, severity: 3, triggersNoted: ['sueño'] });
    expect(ok.status).toBe(201);
    expect(ok.body.seizure).toMatchObject({ source: 'manual', severity: 3 });
    expect((await create(app, s.auth, { startedAt: 'ayer' })).status).toBe(400);
    expect((await create(app, s.auth, { startedAt: '2024-05-01T10:00:00Z', severity: 9 })).status).toBe(400);
  });

  it('lists in reverse chronological order with pagination and AVL range filters', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    for (let d = 1; d <= 5; d++) await create(app, s.auth, { startedAt: `2024-05-0${d}T10:00:00Z` });
    const all = await request(app).get('/api/v1/seizures?limit=2&page=1').set(s.auth);
    expect(all.body.total).toBe(5);
    expect(all.body.totalPages).toBe(3);
    expect(all.body.seizures.map((x: { startedAt: string }) => x.startedAt.slice(0, 10))).toEqual(['2024-05-05', '2024-05-04']);
    const range = await request(app).get('/api/v1/seizures?from=2024-05-02&to=2024-05-03').set(s.auth);
    expect(range.body.seizures.map((x: { startedAt: string }) => x.startedAt.slice(0, 10))).toEqual(['2024-05-03', '2024-05-02']);
    const p3 = await request(app).get('/api/v1/seizures?limit=2&page=3').set(s.auth);
    expect(p3.body.seizures).toHaveLength(1);
  });

  it('returns previous/next navigation from the doubly linked list', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const ids: string[] = [];
    for (const d of ['2024-05-03', '2024-05-01', '2024-05-02']) {
      ids.push((await create(app, s.auth, { startedAt: `${d}T10:00:00Z` })).body.seizure.id);
    }
    const mid = await request(app).get(`/api/v1/seizures/${ids[2]}`).set(s.auth);
    expect(mid.body.navigation).toEqual({ previousId: ids[1], nextId: ids[0] });
    const first = await request(app).get(`/api/v1/seizures/${ids[1]}`).set(s.auth);
    expect(first.body.navigation.previousId).toBeNull();
  });

  it('updates (reindexing) and deletes', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const c = await create(app, s.auth, { startedAt: '2024-05-01T10:00:00Z' });
    const id = c.body.seizure.id;
    const up = await request(app).put(`/api/v1/seizures/${id}`).set(s.auth).send({ startedAt: '2024-06-01T10:00:00Z', severity: 4 });
    expect(up.body.seizure).toMatchObject({ severity: 4, startedAt: '2024-06-01T10:00:00.000Z' });
    expect((await request(app).get('/api/v1/seizures?from=2024-06-01&to=2024-06-01').set(s.auth)).body.total).toBe(1);
    expect((await request(app).delete(`/api/v1/seizures/${id}`).set(s.auth)).status).toBe(204);
    expect((await request(app).get('/api/v1/seizures').set(s.auth)).body.total).toBe(0);
  });

  it('keeps seizures private per user', async () => {
    const { app } = createTestApp();
    const a = await registerUser(app);
    const b = await registerUser(app);
    const c = await create(app, a.auth, { startedAt: '2024-05-01T10:00:00Z' });
    expect((await request(app).get(`/api/v1/seizures/${c.body.seizure.id}`).set(b.auth)).status).toBe(404);
    expect((await request(app).put(`/api/v1/seizures/${c.body.seizure.id}`).set(b.auth).send({ severity: 1 })).status).toBe(404);
    expect((await request(app).get('/api/v1/seizures').set(b.auth)).body.total).toBe(0);
  });

  it('computes stats with trigger graph and low-sleep correlation', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    await create(app, s.auth, { startedAt: '2024-05-01T10:00:00Z', durationSeconds: 60, severity: 2, seizureType: 'tonico-clonica', triggersNoted: ['sueño', 'estrés'] });
    await create(app, s.auth, { startedAt: '2024-05-10T22:00:00Z', durationSeconds: 120, severity: 4, seizureType: 'tonico-clonica', triggersNoted: ['sueño', 'estrés', 'alcohol'] });
    await request(app).put('/api/v1/daily-logs/2024-05-01').set(s.auth).send({ sleepHours: 3 });
    await request(app).put('/api/v1/daily-logs/2024-05-10').set(s.auth).send({ sleepHours: 8 });
    const res = await request(app).get('/api/v1/seizures/stats').set(s.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, avgDurationSeconds: 90, lowSleepShare: 0.5, lowSleepSamples: 2 });
    expect(res.body.byHour[10]).toBe(1);
    expect(res.body.byHour[22]).toBe(1);
    expect(res.body.byType['tonico-clonica']).toBe(2);
    expect(res.body.triggers.top[0].count).toBe(2);
    expect(res.body.triggers.coOccurrences[0]).toMatchObject({ weight: 2 });
    expect(res.body.daysSinceLast).toBeGreaterThan(0);
  });

  it('returns empty stats without seizures', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const res = await request(app).get('/api/v1/seizures/stats').set(s.auth);
    expect(res.body).toMatchObject({ total: 0, lastSeizureAt: null, daysSinceLast: null, lowSleepShare: null });
  });
});
