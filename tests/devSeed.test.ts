import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoData } from '../src/devSeed';
import { createTestApp } from './helpers';

describe('demo seed', () => {
  it('lets the demo user log in and exposes correlated data', async () => {
    const { app, ctx } = createTestApp({ fetchFn: (async () => { throw new Error('down'); }) as never });
    await seedDemoData(ctx.repos, 4);
    const login = await request(app).post('/api/v1/auth/login').send({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };
    const stats = await request(app).get('/api/v1/seizures/stats').set(auth);
    expect(stats.body.total).toBeGreaterThanOrEqual(5);
    expect(stats.body.lowSleepShare).toBe(1);
    const insights = await request(app).post('/api/v1/ai/insights/refresh').set(auth);
    expect(insights.body.insights.map((i: { kind: string }) => i.kind)).toContain('sleep_correlation');
  });
});
