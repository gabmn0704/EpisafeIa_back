import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { AiClient, AiServiceError } from '../src/modules/ai/AiClient';

const log = pino({ level: 'silent' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const make = (fetchFn: typeof fetch, timeoutMs = 200) => new AiClient({ baseUrl: 'http://ai:5000', timeoutMs, log, fetchFn });

describe('AiClient', () => {
  it('posts JSON and returns insights', async () => {
    const fetchFn = vi.fn(async () => json({ insights: [{ kind: 'k', title: 't', body: 'b', evidence: {}, confidence: 0.9 }] }));
    const out = await make(fetchFn as never).analyzePatterns({ seizures: [], dailyLogs: [], medicationLogs: [] });
    expect(out).toHaveLength(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ai:5000/analyze/patterns');
    expect(init.method).toBe('POST');
  });

  it('clamps and normalises risk responses', async () => {
    const fetchFn = async () => json({ score: 140.4, level: 'critical', factors: [] });
    const r = await make(fetchFn as never).scoreRisk({ today: {} as never, history: {} as never });
    expect(r).toMatchObject({ score: 100, level: 'critical', modelVersion: 'unknown', confidence: 0.5 });
  });

  it('throws AiServiceError on HTTP errors, invalid payloads and network failures', async () => {
    await expect(make((async () => json({}, 500)) as never).scoreRisk({} as never)).rejects.toBeInstanceOf(AiServiceError);
    await expect(make((async () => json({ nope: 1 })) as never).analyzePatterns({} as never)).rejects.toBeInstanceOf(AiServiceError);
    await expect(make((async () => json({ score: 'x' })) as never).scoreRisk({} as never)).rejects.toBeInstanceOf(AiServiceError);
    const failing = async () => {
      throw new Error('ECONNREFUSED');
    };
    await expect(make(failing as never).scoreRisk({} as never)).rejects.toThrow(/unreachable/);
  });

  it('aborts slow requests after the timeout', async () => {
    const slow = (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    await expect(make(slow as never, 30).scoreRisk({} as never)).rejects.toBeInstanceOf(AiServiceError);
  });
});
