import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers';

describe('reports', () => {
  it('requires authentication', async () => {
    const { app } = createTestApp();
    expect((await request(app).get('/api/v1/reports/medical')).status).toBe(401);
  });

  it('builds a JSON report with seizures, habits and medication adherence', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    await request(app).post('/api/v1/seizures').set(s.auth).send({ startedAt: '2024-05-03T10:00:00Z', durationSeconds: 60, severity: 3, triggersNoted: ['sueño'] });
    await request(app).post('/api/v1/seizures').set(s.auth).send({ startedAt: '2024-05-10T10:00:00Z', durationSeconds: 120, severity: 2, triggersNoted: ['sueño', 'alcohol'] });
    await request(app).post('/api/v1/seizures').set(s.auth).send({ startedAt: '2024-07-10T10:00:00Z' });
    for (const [d, h] of [['2024-05-01', 4], ['2024-05-02', 8], ['2024-05-03', 6]] as const) {
      await request(app).put(`/api/v1/daily-logs/${d}`).set(s.auth).send({ sleepHours: h, stressLevel: 6, caffeineMg: 200 });
    }
    await request(app).post('/api/v1/medications').set(s.auth).send({ name: 'Lamotrigina', dose: '100', unit: 'mg', scheduleTimes: ['08:00'] });

    const res = await request(app).get('/api/v1/reports/medical?from=2024-05-01&to=2024-05-31').set(s.auth);
    expect(res.status).toBe(200);
    const r = res.body.report;
    expect(r.period).toEqual({ from: '2024-05-01', to: '2024-05-31' });
    expect(r.patient.fullName).toBe('Usuario Prueba');
    expect(r.seizures).toMatchObject({ total: 2, avgDurationSeconds: 90, bySeverity: { '2': 1, '3': 1 } });
    expect(r.seizures.topTriggers[0]).toEqual({ name: 'sueño', count: 2 });
    expect(r.lifestyle).toMatchObject({ daysLogged: 3, avgSleepHours: 6, minSleepHours: 4, avgStress: 6, avgCaffeineMg: 200, shortSleepDays: 1 });
    expect(r.medications[0]).toMatchObject({ name: 'Lamotrigina', adherenceRate: null });
    expect(r.disclaimer).toBeTruthy();
  });

  it('returns printable HTML', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const res = await request(app).get('/api/v1/reports/medical?format=html').set(s.auth);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('Informe de seguimiento');
    expect(res.text).toContain('Sin crisis registradas');
  });

  it('validates parameters', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    expect((await request(app).get('/api/v1/reports/medical?from=2024-06-01&to=2024-05-01').set(s.auth)).status).toBe(400);
    expect((await request(app).get('/api/v1/reports/medical?format=pdf').set(s.auth)).status).toBe(400);
    expect((await request(app).get('/api/v1/reports/medical?from=hoy').set(s.auth)).status).toBe(400);
  });
});
