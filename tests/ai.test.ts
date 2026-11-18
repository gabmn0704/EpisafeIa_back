import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp, registerUser } from './helpers';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const fakeAi = () =>
  vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith('/risk/score')) {
      return json({ score: 42, level: 'moderate', factors: [{ name: 'sueño', impact: 0.4, direction: 'up', detail: 'x' }], modelVersion: 'logreg-1', confidence: 0.8 });
    }
    return json({ insights: [{ kind: 'sleep', title: 'Sueño', body: 'Duerme más', evidence: { n: 5 }, confidence: 0.9 }] });
  });

const down = vi.fn(async () => {
  throw new Error('ECONNREFUSED');
});

describe('ai (service up)', () => {
  it('uses the AI service for risk and persists the assessment', async () => {
    const fetchFn = fakeAi();
    const { app } = createTestApp({ fetchFn: fetchFn as never });
    const s = await registerUser(app);
    await request(app).put(`/api/v1/daily-logs/${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })}`).set(s.auth).send({ sleepHours: 4, stressLevel: 7 });
    const res = await request(app).get('/api/v1/ai/risk/today').set(s.auth);
    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(false);
    expect(res.body.assessment).toMatchObject({ score: 42, level: 'moderate', modelVersion: 'logreg-1' });
    const sent = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.today).toMatchObject({ sleepHours: 4, stressLevel: 7, missedMeds: 0 });
    const hist = await request(app).get('/api/v1/ai/risk/history?days=7').set(s.auth);
    expect(hist.body.assessments).toHaveLength(1);
  });

  it('caches risk for repeated calls and publishes risk_updated', async () => {
    const fetchFn = fakeAi();
    const { app, ctx } = createTestApp({ fetchFn: fetchFn as never });
    const s = await registerUser(app);
    const seen: string[] = [];
    ctx.bus.subscribe((e) => seen.push(e.name));
    await request(app).get('/api/v1/ai/risk/today').set(s.auth);
    await request(app).get('/api/v1/ai/risk/today').set(s.auth);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['risk_updated']);
  });

  it('refreshes insights from the AI service and replaces old ones', async () => {
    const { app } = createTestApp({ fetchFn: fakeAi() as never });
    const s = await registerUser(app);
    const first = await request(app).post('/api/v1/ai/insights/refresh').set(s.auth);
    expect(first.body.degraded).toBe(false);
    expect(first.body.insights[0]).toMatchObject({ title: 'Sueño', kind: 'sleep' });
    await request(app).post('/api/v1/ai/insights/refresh').set(s.auth);
    const list = await request(app).get('/api/v1/ai/insights').set(s.auth);
    expect(list.body.insights).toHaveLength(1);
  });
});

describe('ai (service down -> fallback)', () => {
  it('marks risk as degraded and still answers', async () => {
    const { app } = createTestApp({ fetchFn: down as never });
    const s = await registerUser(app);
    const res = await request(app).get('/api/v1/ai/risk/today').set(s.auth);
    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
    expect(res.body.assessment.modelVersion).toBe('fallback-local-1');
    expect(res.body.assessment.score).toBeGreaterThanOrEqual(0);
  });

  it('falls back to local insights computed from real data', async () => {
    const { app } = createTestApp({ fetchFn: down as never });
    const s = await registerUser(app);
    const now = Date.now();
    for (let i = 1; i <= 12; i++) {
      const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
      await request(app).put(`/api/v1/daily-logs/${d}`).set(s.auth).send({ sleepHours: i <= 4 ? 4 : 8 });
      if (i <= 4) await request(app).post('/api/v1/seizures').set(s.auth).send({ startedAt: `${d}T12:00:00Z`, triggersNoted: ['estrés'] });
    }
    const res = await request(app).post('/api/v1/ai/insights/refresh').set(s.auth);
    expect(res.body.degraded).toBe(true);
    const kinds = res.body.insights.map((i: { kind: string }) => i.kind);
    expect(kinds).toContain('sleep_correlation');
    const stored = await request(app).get('/api/v1/ai/insights').set(s.auth);
    expect(stored.body.degraded).toBe(true);
  });

  it('requires authentication', async () => {
    const { app } = createTestApp({ fetchFn: down as never });
    expect((await request(app).get('/api/v1/ai/risk/today')).status).toBe(401);
    const s = await registerUser(app);
    expect((await request(app).get('/api/v1/ai/risk/history?days=0').set(s.auth)).status).toBe(400);
  });
});
