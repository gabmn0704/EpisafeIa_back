import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, registerUser } from './helpers';

const creds = { email: 'ana@test.com', password: 'Secret123', fullName: 'Ana Perez' };

describe('auth', () => {
  it('registers, hides the password hash and returns tokens', async () => {
    const { app } = createTestApp();
    const res = await request(app).post('/api/v1/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'ana@test.com', role: 'patient', timezone: 'America/Bogota' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('rejects invalid payloads with the uniform error format', async () => {
    const { app } = createTestApp();
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'bad', password: '123', fullName: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('rejects duplicate emails (case-insensitive)', async () => {
    const { app } = createTestApp();
    await request(app).post('/api/v1/auth/register').send(creds);
    const dup = await request(app).post('/api/v1/auth/register').send({ ...creds, email: 'ANA@test.com' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
  });

  it('logs in and rejects wrong credentials', async () => {
    const { app } = createTestApp();
    await request(app).post('/api/v1/auth/register').send(creds);
    const ok = await request(app).post('/api/v1/auth/login').send({ email: creds.email, password: creds.password });
    expect(ok.status).toBe(200);
    const bad = await request(app).post('/api/v1/auth/login').send({ email: creds.email, password: 'wrong' });
    expect(bad.status).toBe(401);
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@test.com', password: 'x' });
    expect(unknown.status).toBe(401);
  });

  it('locks the account after repeated failures', async () => {
    const { app } = createTestApp();
    await request(app).post('/api/v1/auth/register').send(creds);
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/v1/auth/login').send({ email: creds.email, password: 'bad' });
    }
    const locked = await request(app).post('/api/v1/auth/login').send({ email: creds.email, password: creds.password });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');
  });

  it('protects /me with a bearer token', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer junk')).status).toBe(401);
    const me = await request(app).get('/api/v1/auth/me').set(s.auth);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(s.userId);
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const first = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(s.refreshToken);
    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(reuse.status).toBe(401);
    const bogus = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'x'.repeat(40) });
    expect(bogus.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const out = await request(app).post('/api/v1/auth/logout').send({ refreshToken: s.refreshToken });
    expect(out.status).toBe(200);
    const again = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(again.status).toBe(401);
  });
});
