import { describe, expect, it } from 'vitest';
import { SegmentTree } from '../../src/structures/SegmentTree';

describe('SegmentTree', () => {
  const data = [4, 8, 2, 9, 1, 7, 3];

  it('answers min queries', () => {
    const t = SegmentTree.min(data);
    expect(t.query(0, 6)).toBe(1);
    expect(t.query(0, 3)).toBe(2);
    expect(t.query(5, 6)).toBe(3);
    expect(t.query(1, 1)).toBe(8);
  });

  it('answers max and sum queries', () => {
    expect(SegmentTree.max(data).query(0, 2)).toBe(8);
    expect(SegmentTree.sum(data).query(2, 4)).toBe(12);
  });

  it('supports point updates', () => {
    const t = SegmentTree.min(data);
    t.update(4, 100);
    expect(t.query(0, 6)).toBe(2);
    t.update(2, 0);
    expect(t.query(0, 6)).toBe(0);
  });

  it('matches brute force on random ranges', () => {
    const arr = Array.from({ length: 64 }, (_, i) => (i * 53) % 29);
    const t = SegmentTree.max(arr);
    for (let l = 0; l < 64; l += 7) {
      for (let r = l; r < 64; r += 5) expect(t.query(l, r)).toBe(Math.max(...arr.slice(l, r + 1)));
    }
  });

  it('rejects invalid ranges', () => {
    const t = SegmentTree.sum(data);
    expect(() => t.query(3, 2)).toThrow(RangeError);
    expect(() => t.query(0, 99)).toThrow(RangeError);
    expect(() => t.update(-1, 1)).toThrow(RangeError);
  });
});
