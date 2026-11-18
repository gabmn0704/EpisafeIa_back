import { describe, expect, it } from 'vitest';
import { levelFor, round, sigmoid, wilsonInterval } from '../src/modules/ai/stats';

describe('ai stats', () => {
  it('computes Wilson intervals', () => {
    const ci = wilsonInterval(8, 10);
    expect(ci.low).toBeCloseTo(0.49, 1);
    expect(ci.high).toBeCloseTo(0.94, 1);
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 0 });
    expect(wilsonInterval(10, 10).high).toBeLessThanOrEqual(1);
  });

  it('narrows the interval as n grows', () => {
    const a = wilsonInterval(5, 10);
    const b = wilsonInterval(500, 1000);
    expect(b.high - b.low).toBeLessThan(a.high - a.low);
  });

  it('sigmoid, round and level helpers', () => {
    expect(sigmoid(0)).toBe(0.5);
    expect(round(1.2345, 2)).toBe(1.23);
    expect([10, 30, 60, 90].map(levelFor)).toEqual(['low', 'moderate', 'high', 'critical']);
  });
});
