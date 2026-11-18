import type { Express } from 'express';
import pino from 'pino';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config/env';
import { buildContext, type AppContext } from '../src/container';
import { createMemoryRepos } from '../src/repositories/memory';

export interface TestApp {
  app: Express;
  ctx: AppContext;
}

/** App completa con repositorios en memoria (sin Postgres ni red). */
export function createTestApp(overrides: Partial<Parameters<typeof buildContext>[0]> = {}, env: NodeJS.ProcessEnv = {}): TestApp {
  const config = loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123',
    BCRYPT_ROUNDS: '4',
    ...env,
  });
  const ctx = buildContext({ config, log: pino({ level: 'silent' }), repos: createMemoryRepos(), ...overrides });
  return { app: createApp(ctx), ctx };
}

export interface Session {
  token: string;
  refreshToken: string;
  userId: string;
  auth: { Authorization: string };
}

let counter = 0;

export async function registerUser(app: Express, email = `user${++counter}@test.com`): Promise<Session> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'Secret123', fullName: 'Usuario Prueba' });
  if (res.status !== 201) throw new Error('register failed: ' + JSON.stringify(res.body));
  return {
    token: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    userId: res.body.user.id,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
}
