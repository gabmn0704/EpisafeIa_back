import { describe, expect, it } from 'vitest';
import { EventBus, type StreamEvent } from '../../src/services/EventBus';

describe('EventBus', () => {
  it('delivers events to subscribers and supports unsubscribe', () => {
    const bus = new EventBus();
    const got: StreamEvent[] = [];
    const off = bus.subscribe((e) => got.push(e));
    bus.publish({ userId: 'u', name: 'emergency', data: { a: 1 } });
    expect(bus.listenerCount).toBe(1);
    off();
    bus.publish({ userId: 'u', name: 'risk_updated', data: {} });
    expect(got).toHaveLength(1);
    expect(bus.listenerCount).toBe(0);
  });
});
