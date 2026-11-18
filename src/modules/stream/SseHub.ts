import type { Response } from 'express';
import type { EventBus, StreamEvent } from '../../services/EventBus';
import { HashTable } from '../../structures/HashTable';

/** Gestiona conexiones SSE por usuario y reenvía los eventos del bus. */
export class SseHub {
  private clients = new HashTable<Set<Response>>();
  private unsubscribe: (() => void) | null = null;
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(
    private readonly bus: EventBus,
    private readonly heartbeatMs = 25_000,
  ) {}

  get connections(): number {
    let n = 0;
    for (const [, set] of this.clients.entries()) n += set.size;
    return n;
  }

  private start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.bus.subscribe((e) => this.dispatch(e));
    this.heartbeat = setInterval(() => this.broadcastComment('hb'), this.heartbeatMs);
    this.heartbeat.unref();
  }

  private stopIfIdle(): void {
    if (this.connections > 0) return;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  attach(userId: string, res: Response): void {
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    res.write('retry: 5000\n');
    res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);

    this.clients.getOrSet(userId, () => new Set()).add(res);
    this.start();
    res.on('close', () => {
      const set = this.clients.get(userId);
      set?.delete(res);
      if (set && set.size === 0) this.clients.delete(userId);
      this.stopIfIdle();
    });
  }

  private dispatch(e: StreamEvent): void {
    const set = this.clients.get(e.userId);
    if (!set) return;
    const frame = `event: ${e.name}\ndata: ${JSON.stringify(e.data)}\n\n`;
    for (const res of set) res.write(frame);
  }

  private broadcastComment(text: string): void {
    for (const [, set] of this.clients.entries()) for (const res of set) res.write(`: ${text}\n\n`);
  }
}
