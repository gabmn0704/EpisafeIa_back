import type { Logger } from 'pino';
import type { AiInsight, PatternsRequest, RiskRequest, RiskResponse } from './types';

export interface AiClientOptions {
  baseUrl: string;
  timeoutMs: number;
  log: Logger;
  fetchFn?: typeof fetch;
}

export class AiServiceError extends Error {}

/** Cliente HTTP del servicio de IA (repo episafeIA_IA). Lanza AiServiceError si no responde. */
export class AiClient {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: AiClientOptions) {
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const res = await this.fetchFn(`${this.opts.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new AiServiceError(`AI service responded ${res.status} on ${path}`);
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof AiServiceError) throw err;
      this.opts.log.warn({ err: (err as Error).message, path }, 'AI service unreachable');
      throw new AiServiceError(`AI service unreachable: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async analyzePatterns(req: PatternsRequest): Promise<AiInsight[]> {
    const res = await this.post<{ insights?: AiInsight[] }>('/analyze/patterns', req);
    if (!Array.isArray(res.insights)) throw new AiServiceError('Invalid insights payload');
    return res.insights;
  }

  async scoreRisk(req: RiskRequest): Promise<RiskResponse> {
    const res = await this.post<Partial<RiskResponse>>('/risk/score', req);
    if (typeof res.score !== 'number' || !res.level || !Array.isArray(res.factors)) {
      throw new AiServiceError('Invalid risk payload');
    }
    return {
      score: Math.max(0, Math.min(100, Math.round(res.score))),
      level: res.level,
      factors: res.factors,
      modelVersion: res.modelVersion ?? 'unknown',
      confidence: res.confidence ?? 0.5,
    };
  }
}
