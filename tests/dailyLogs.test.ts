import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers';

const put = (app: ReturnType<typeof createTestApp>['app'], auth: Record<string, string>, date: string, body: object) =>
  request(app).put(`/api/v1/daily-logs/${date}`).set(auth).send(body);

describe('daily logs', () => {
  it('upserts by date: 201 on create, 200 on update', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const a = await put(app, s.auth, '2024-05-01', { sleepHours: 4.5, stressLevel: 8 });
    expect(a.status).toBe(201);
    const b = await put(app, s.auth, '2024-05-01', { caffeineMg: 300 });
    expect(b.status).toBe(200);
    expect(b.body.log).toMatchObject({ sleepHours: 4.5, stressLevel: 8, caffeineMg: 300 });
    const got = await request(app).get('/api/v1/daily-logs/2024-05-01').set(s.auth);
    expect(got.body.log.id).toBe(a.body.log.id);
  });

  it('validates dates and value ranges', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    expect((await put(app, s.auth, '2024-13-40', {})).status).toBe(400);
    expect((await put(app, s.auth, '2024-05-01', { stressLevel: 11 })).status).toBe(400);
    expect((await put(app, s.auth, '2024-05-01', { sleepHours: 30 })).status).toBe(400);
    expect((await request(app).get('/api/v1/daily-logs/2030-01-01').set(s.auth)).status).toBe(404);
  });

  it('answers range queries from the BST index and keeps it fresh', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    for (const d of ['2024-05-01', '2024-05-02', '2024-05-03', '2024-05-04', '2024-05-05']) {
      await put(app, s.auth, d, { sleepHours: 7 });
    }
    const r = await request(app).get('/api/v1/daily-logs?from=2024-05-02&to=2024-05-04').set(s.auth);
    expect(r.body.logs.map((l: { logDate: string }) => l.logDate)).toEqual(['2024-05-02', '2024-05-03', '2024-05-04']);
    await put(app, s.auth, '2024-05-06', { sleepHours: 5 });
    const all = await request(app).get('/api/v1/daily-logs').set(s.auth);
    expect(all.body.logs).toHaveLength(6);
    expect((await request(app).get('/api/v1/daily-logs?from=2024-06-01&to=2024-05-01').set(s.auth)).status).toBe(400);
  });

  it('undoes changes in LIFO order using the stack', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    await put(app, s.auth, '2024-05-01', { sleepHours: 8 });
    await put(app, s.auth, '2024-05-01', { sleepHours: 3 });
    const u1 = await request(app).post('/api/v1/daily-logs/undo').set(s.auth);
    expect(u1.body.restored.sleepHours).toBe(8);
    expect(u1.body.remainingUndo).toBe(1);
    const u2 = await request(app).post('/api/v1/daily-logs/undo').set(s.auth);
    expect(u2.body.restored).toBeNull();
    expect((await request(app).get('/api/v1/daily-logs/2024-05-01').set(s.auth)).status).toBe(404);
    expect((await request(app).post('/api/v1/daily-logs/undo').set(s.auth)).status).toBe(404);
  });

  it('serves a cloned template from defaults or the latest log', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const d = await request(app).get('/api/v1/daily-logs/template').set(s.auth);
    expect(d.body.template).toMatchObject({ sleepHours: 8, mood: 3 });
    await put(app, s.auth, '2024-05-01', { sleepHours: 6, caffeineMg: 150 });
    const t = await request(app).get('/api/v1/daily-logs/template').set(s.auth);
    expect(t.body.template).toMatchObject({ sleepHours: 6, caffeineMg: 150 });
  });

  it('isolates logs between users', async () => {
    const { app } = createTestApp();
    const a = await registerUser(app);
    const b = await registerUser(app);
    await put(app, a.auth, '2024-05-01', { sleepHours: 7 });
    expect((await request(app).get('/api/v1/daily-logs').set(b.auth)).body.logs).toHaveLength(0);
    expect((await request(app).get('/api/v1/daily-logs/2024-05-01').set(b.auth)).status).toBe(404);
  });
});
