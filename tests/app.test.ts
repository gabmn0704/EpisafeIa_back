import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';

describe('app shell', () => {
  it('serves /health without auth', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: true });
  });

  it('reports degraded health when the db check fails', async () => {
    const { app } = createTestApp({ healthCheck: async () => false });
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });

  it('returns uniform 404 errors', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for malformed JSON', async () => {
    const { app } = createTestApp();
    const res = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sets security headers and a request id', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('applies CORS only to configured origins', async () => {
    const { app } = createTestApp();
    const ok = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await request(app).get('/api/v1/health').set('Origin', 'http://evil.com');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
