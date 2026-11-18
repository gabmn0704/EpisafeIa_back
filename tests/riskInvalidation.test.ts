import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp, registerUser } from './helpers';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const aiOk = () =>
  vi.fn(async () => json({ score: 30, level: 'moderate', factors: [], modelVersion: 'logreg-1', confidence: 0.8 }));

describe('risk cache invalidation', () => {
  it('recalculates today risk after the daily log changes', async () => {
    const fetchFn = aiOk();
    const { app } = createTestApp({ fetchFn: fetchFn as never });
    const s = await registerUser(app);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    await request(app).put(`/api/v1/daily-logs/${today}`).set(s.auth).send({ sleepHours: 8, stressLevel: 2 });
    await request(app).get('/api/v1/ai/risk/today').set(s.auth);
    await request(app).get('/api/v1/ai/risk/today').set(s.auth);
    expect(fetchFn).toHaveBeenCalledTimes(1); // second read comes from cache

    await request(app).put(`/api/v1/daily-logs/${today}`).set(s.auth).send({ sleepHours: 4, stressLevel: 9 });
    await request(app).get('/api/v1/ai/risk/today').set(s.auth);
    expect(fetchFn).toHaveBeenCalledTimes(2); // cache dropped, recomputed with new inputs
    const body = JSON.parse((fetchFn.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect(body.today).toMatchObject({ sleepHours: 4, stressLevel: 9 });
  });
});
