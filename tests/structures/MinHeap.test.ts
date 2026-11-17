import { describe, expect, it } from 'vitest';
import { MinHeap } from '../../src/structures/MinHeap';

describe('MinHeap', () => {
  it('pops in ascending order', () => {
    const h = new MinHeap<number>();
    [5, 3, 8, 1, 9, 2, 7].forEach((n) => h.push(n));
    expect(h.peek()).toBe(1);
    const out: number[] = [];
    while (!h.isEmpty()) out.push(h.pop() as number);
    expect(out).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });

  it('supports custom comparators (max-heap)', () => {
    const h = new MinHeap<number>((a, b) => b - a);
    [1, 4, 2].forEach((n) => h.push(n));
    expect(h.pop()).toBe(4);
  });

  it('handles empty heap', () => {
    expect(new MinHeap<number>().pop()).toBeUndefined();
  });

  it('sorts pseudo-random data like Array.sort', () => {
    const data = Array.from({ length: 200 }, (_, i) => (i * 7919) % 101);
    const h = new MinHeap<number>();
    data.forEach((n) => h.push(n));
    const out: number[] = [];
    while (!h.isEmpty()) out.push(h.pop() as number);
    expect(out).toEqual([...data].sort((a, b) => a - b));
  });

  it('topK returns the k smallest', () => {
    expect(MinHeap.topK([9, 1, 5, 3], 2, (a, b) => a - b)).toEqual([1, 3]);
  });
});
