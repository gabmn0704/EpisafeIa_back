import { describe, expect, it } from 'vitest';
import { FenwickTree } from '../../src/structures/FenwickTree';

describe('FenwickTree', () => {
  it('computes prefix and range sums', () => {
    const f = FenwickTree.from([5, 3, 7, 9, 6, 4]);
    expect(f.prefixSum(0)).toBe(5);
    expect(f.prefixSum(5)).toBe(34);
    expect(f.rangeSum(1, 3)).toBe(19);
    expect(f.rangeSum(3, 1)).toBe(0);
    expect(f.get(2)).toBe(7);
  });

  it('updates points', () => {
    const f = FenwickTree.from([1, 1, 1, 1]);
    f.add(2, 9);
    expect(f.rangeSum(0, 3)).toBe(13);
    expect(f.get(2)).toBe(10);
  });

  it('matches a naive implementation', () => {
    const data = Array.from({ length: 100 }, (_, i) => (i * 37) % 11);
    const f = FenwickTree.from(data);
    for (const [l, r] of [[0, 99], [10, 20], [50, 50], [3, 97]] as const) {
      expect(f.rangeSum(l, r)).toBe(data.slice(l, r + 1).reduce((a, b) => a + b, 0));
    }
  });

  it('validates indexes', () => {
    const f = new FenwickTree(3);
    expect(() => f.add(3, 1)).toThrow(RangeError);
    expect(() => f.prefixSum(10)).toThrow(RangeError);
    expect(f.prefixSum(-1)).toBe(0);
  });
});
