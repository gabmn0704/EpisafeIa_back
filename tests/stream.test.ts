import type { AddressInfo } from 'node:net';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/services/EventBus';
import { SseHub } from '../src/modules/stream/SseHub';
import { createTestApp, registerUser } from './helpers';

function fakeRes() {
  const emitter = new EventEmitter();
  const written: string[] = [];
  const res = Object.assign(emitter, {
    status() { return res; },
    set() { return res; },
    flushHeaders() {},
    write(chunk: string) { written.push(chunk); return true; },
  });
  return { res: res as unknown as Response, written, close: () => emitter.emit('close') };
}

describe('SseHub', () => {
  it('delivers events only to the owning user and cleans up on close', () => {
    const bus = new EventBus();
    const hub = new SseHub(bus, 60_000);
    const a = fakeRes();
    const b = fakeRes();
    hub.attach('a', a.res);
    hub.attach('b', b.res);
    expect(hub.connections).toBe(2);
    bus.publish({ userId: 'a', name: 'emergency', data: { ok: true } });
    expect(a.written.join('')).toContain('event: emergency\ndata: {"ok":true}');
    expect(b.written.join('')).not.toContain('emergency');
    a.close();
    b.close();
    expect(hub.connections).toBe(0);
    expect(bus.listenerCount).toBe(0);
  });

  it('sends a ready frame on connect', () => {
    const hub = new SseHub(new EventBus(), 60_000);
    const c = fakeRes();
    hub.attach('u', c.res);
    expect(c.written.join('')).toContain('event: ready');
    c.close();
  });
});

describe('GET /stream', () => {
  it('rejects missing or invalid tokens', async () => {
    const { app } = createTestApp();
    expect((await request(app).get('/api/v1/stream')).status).toBe(401);
    expect((await request(app).get('/api/v1/stream?token=not-a-valid-jwt-token')).status).toBe(401);
  });

  it('streams emergency events end to end over real HTTP', async () => {
    const { app } = createTestApp();
    const s = await registerUser(app);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const controller = new AbortController();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/stream?token=${s.token}`, { signal: controller.signal });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      const readUntil = async (needle: string) => {
        while (!text.includes(needle)) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value);
        }
      };
      await readUntil('event: ready');
      await request(app).post('/api/v1/emergency').set(s.auth).send({});
      await readUntil('event: emergency');
      expect(text).toContain('event: emergency');
    } finally {
      controller.abort();
      server.close();
    }
  });
});
