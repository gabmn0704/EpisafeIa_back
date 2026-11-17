import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers';

type App = ReturnType<typeof createTestApp>['app'];

const iso = (secondsAgo: number) => new Date(Date.now() - secondsAgo * 1000).toISOString();

const post = (app: App, auth: Record<string, string>, samples: object[], deviceId?: string) =>
  request(app).post('/api/v1/wearables/samples').set(auth).send({ deviceId, samples });

describe('wearables', () => {
  it('manages devices', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const d = await request(app).post('/api/v1/wearables/devices').set(s.auth).send({ provider: 'web_bluetooth', deviceName: 'Mi Band' });
    expect(d.status).toBe(201);
    expect((await request(app).get('/api/v1/wearables/devices').set(s.auth)).body.devices).toHaveLength(1);
    expect((await request(app).post('/api/v1/wearables/devices').set(s.auth).send({ provider: 'nokia' })).status).toBe(400);
    expect((await request(app).delete(`/api/v1/wearables/devices/${d.body.device.id}`).set(s.auth)).status).toBe(204);
  });

  it('ingests samples, validates limits and updates device last seen', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const d = await request(app).post('/api/v1/wearables/devices').set(s.auth).send({ provider: 'manual' });
    const ok = await post(app, s.auth, [{ sampledAt: iso(10), heartRate: 70 }, { sampledAt: iso(5), heartRate: 72 }], d.body.device.id);
    expect(ok.status).toBe(201);
    expect(ok.body.accepted).toBe(2);
    const devices = await request(app).get('/api/v1/wearables/devices').set(s.auth);
    expect(devices.body.devices[0].lastSeenAt).toBeTruthy();

    expect((await post(app, s.auth, [])).status).toBe(400);
    const tooMany = Array.from({ length: 201 }, (_, i) => ({ sampledAt: iso(i), heartRate: 70 }));
    expect((await post(app, s.auth, tooMany)).status).toBe(400);
    expect((await post(app, s.auth, [{ sampledAt: iso(1), heartRate: 500 }])).status).toBe(400);
    expect((await post(app, s.auth, [{ sampledAt: iso(1), heartRate: 70 }], '00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('serves the live circular window ordered chronologically and filtered by minutes', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    await post(app, s.auth, [
      { sampledAt: iso(30 * 60), heartRate: 60 },
      { sampledAt: iso(20), heartRate: 80 },
      { sampledAt: iso(40), heartRate: 75 },
    ]);
    const live = await request(app).get('/api/v1/wearables/live?minutes=10').set(s.auth);
    expect(live.body.count).toBe(2);
    expect(live.body.samples.map((x: { heartRate: number }) => x.heartRate)).toEqual([75, 80]);
    const wide = await request(app).get('/api/v1/wearables/live?minutes=60').set(s.auth);
    expect(wide.body.count).toBe(3);
  });

  it('creates tachycardia alerts in streaming, with cooldown, and publishes to the bus', async () => {
    const { app, ctx } = createTestApp();
    const s = await registerUser(app);
    const events: string[] = [];
    ctx.bus.subscribe((e) => events.push(e.name));
    const samples = Array.from({ length: 8 }, (_, i) => ({ sampledAt: iso(80 - i * 10), heartRate: 140, motionIntensity: 0.1 }));
    const res = await post(app, s.auth, samples);
    const kinds = res.body.alerts.map((a: { kind: string }) => a.kind);
    expect(kinds.filter((k: string) => k === 'tachycardia')).toHaveLength(1);
    expect(events).toContain('wearable_alert');
    const list = await request(app).get('/api/v1/wearables/alerts').set(s.auth);
    expect(list.body.alerts).toHaveLength(res.body.alerts.length);
  });

  it('detects convulsive movement and escalates the alert into an emergency', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    await request(app).post('/api/v1/contacts').set(s.auth).send({ name: 'Mamá', phone: '+57 300 111 2222', priority: 1 });
    const samples = [0.2, 0.9, 0.95, 0.9, 0.85, 0.9].map((m, i) => ({ sampledAt: iso(60 - i * 5), heartRate: 100, motionIntensity: m }));
    const res = await post(app, s.auth, samples);
    const alert = res.body.alerts.find((a: { kind: string }) => a.kind === 'motion_convulsive');
    expect(alert).toBeTruthy();

    const esc = await request(app).post(`/api/v1/wearables/alerts/${alert.id}/escalate`).set(s.auth);
    expect(esc.status).toBe(201);
    expect(esc.body.alert.convertedEventId).toBe(esc.body.emergency.event.id);
    expect(esc.body.emergency.seizure.source).toBe('wearable');
    expect((await request(app).post(`/api/v1/wearables/alerts/${alert.id}/escalate`).set(s.auth)).status).toBe(409);
  });

  it('summarises a time window', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    await post(app, s.auth, [
      { sampledAt: iso(100), heartRate: 60, hrvMs: 50, spo2: 98, steps: 10, motionIntensity: 0.2 },
      { sampledAt: iso(50), heartRate: 80, hrvMs: 30, spo2: 96, steps: 5, motionIntensity: 0.4 },
    ]);
    const res = await request(app).get('/api/v1/wearables/summary?hours=24').set(s.auth);
    expect(res.body).toMatchObject({ samples: 2, steps: 15, avgHrvMs: 40, avgSpo2: 97, maxMotion: 0.4 });
    expect(res.body.heartRate).toEqual({ avg: 70, min: 60, max: 80 });
    expect(res.body.hourly.length).toBeGreaterThan(0);
  });

  it('isolates alerts and devices between users', async () => {
    const { app } = createTestApp();
    const a = await registerUser(app);
    const b = await registerUser(app);
    const d = await request(app).post('/api/v1/wearables/devices').set(a.auth).send({ provider: 'manual' });
    expect((await request(app).delete(`/api/v1/wearables/devices/${d.body.device.id}`).set(b.auth)).status).toBe(404);
    expect((await request(app).post('/api/v1/wearables/alerts/00000000-0000-4000-8000-000000000000/escalate').set(b.auth)).status).toBe(404);
  });
});
