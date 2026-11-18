import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers';

const down = async () => {
  throw new Error('ECONNREFUSED');
};

describe('dashboard', () => {
  it('requires authentication', async () => {
    const { app } = createTestApp();
    expect((await request(app).get('/api/v1/dashboard/summary')).status).toBe(401);
  });

  it('returns an empty but well-formed summary for a new user (AI down)', async () => {
    const { app } = createTestApp({ fetchFn: down as never });
    const s = await registerUser(app);
    const res = await request(app).get('/api/v1/dashboard/summary').set(s.auth);
    expect(res.status).toBe(200);
    expect(res.body.risk).toMatchObject({ degraded: true });
    expect(res.body).toMatchObject({
      lastSeizure: null,
      seizureFreeStreakDays: null,
      currentHeartRate: null,
      activeEmergencies: 0,
      activeAlerts: { count: 0, items: [] },
    });
  });

  it('aggregates risk, streak, pulse, alerts and emergencies', async () => {
    const { app } = createTestApp({ fetchFn: down as never });
    const s = await registerUser(app);
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
    await request(app).post('/api/v1/seizures').set(s.auth).send({ startedAt: daysAgo(5), severity: 3 });
    const now = Date.now();
    const samples = Array.from({ length: 6 }, (_, i) => ({ sampledAt: new Date(now - (60 - i * 5) * 1000).toISOString(), heartRate: 140, motionIntensity: 0.1 }));
    await request(app).post('/api/v1/wearables/samples').set(s.auth).send({ samples });
    await request(app).post('/api/v1/emergency').set(s.auth).send({});

    const res = await request(app).get('/api/v1/dashboard/summary').set(s.auth);
    expect(res.body.seizureFreeStreakDays).toBeGreaterThanOrEqual(0);
    expect(res.body.lastSeizure).toBeTruthy();
    expect(res.body.currentHeartRate).toBe(140);
    expect(res.body.activeAlerts.count).toBeGreaterThan(0);
    expect(res.body.activeEmergencies).toBe(1);
    expect(typeof res.body.risk.score).toBe('number');
  });
});
