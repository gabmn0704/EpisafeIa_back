import { describe, expect, it } from 'vitest';
import { CircularBuffer } from '../../src/structures/CircularBuffer';

describe('CircularBuffer', () => {
  it('rejects invalid capacity', () => {
    expect(() => new CircularBuffer(0)).toThrow(RangeError);
  });

  it('keeps insertion order until full', () => {
    const b = new CircularBuffer<number>(3);
    b.push(1);
    b.push(2);
    expect(b.toArray()).toEqual([1, 2]);
    expect(b.isFull()).toBe(false);
  });

  it('overwrites the oldest and reports eviction', () => {
    const b = new CircularBuffer<number>(3);
    [1, 2, 3].forEach((n) => b.push(n));
    expect(b.push(4)).toBe(1);
    expect(b.toArray()).toEqual([2, 3, 4]);
    expect(b.at(0)).toBe(2);
    expect(b.latest()).toBe(4);
    expect(b.at(5)).toBeUndefined();
  });

  it('wraps around many times', () => {
    const b = new CircularBuffer<number>(4);
    for (let i = 0; i < 50; i++) b.push(i);
    expect(b.toArray()).toEqual([46, 47, 48, 49]);
    expect(b.last(2)).toEqual([48, 49]);
    expect(b.filter((x) => x % 2 === 0)).toEqual([46, 48]);
  });

  it('clears', () => {
    const b = new CircularBuffer<number>(2);
    b.push(1);
    b.clear();
    expect(b.size).toBe(0);
    expect([...b]).toEqual([]);
  });
});
