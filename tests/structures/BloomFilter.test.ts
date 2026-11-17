import { describe, expect, it } from 'vitest';
import { BloomFilter } from '../../src/structures/BloomFilter';

describe('BloomFilter', () => {
  it('never yields false negatives', () => {
    const f = new BloomFilter(1000, 0.01);
    const items = Array.from({ length: 1000 }, (_, i) => 'user' + i + '@mail.com');
    items.forEach((i) => f.add(i));
    expect(items.every((i) => f.mightContain(i))).toBe(true);
    expect(f.count).toBe(1000);
  });

  it('keeps the false positive rate near the target', () => {
    const f = new BloomFilter(1000, 0.01);
    for (let i = 0; i < 1000; i++) f.add('in' + i);
    let fp = 0;
    for (let i = 0; i < 5000; i++) if (f.mightContain('out' + i)) fp++;
    expect(fp / 5000).toBeLessThan(0.03);
    expect(f.estimatedFalsePositiveRate()).toBeLessThan(0.03);
  });

  it('reports absent items on an empty filter', () => {
    expect(new BloomFilter().mightContain('x')).toBe(false);
  });
});
