import { EventEmitter } from 'node:events';

export type StreamEventName = 'emergency' | 'wearable_alert' | 'risk_updated';

export interface StreamEvent {
  userId: string;
  name: StreamEventName;
  data: unknown;
}

/** Bus de eventos en proceso: los servicios publican y el endpoint SSE entrega. */
export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(event: StreamEvent): void {
    this.emitter.emit('event', event);
  }

  /** Devuelve la función para cancelar la suscripción. */
  subscribe(listener: (e: StreamEvent) => void): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }

  get listenerCount(): number {
    return this.emitter.listenerCount('event');
  }
}
