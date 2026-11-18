import { describe, expect, it } from 'vitest';
import { HashTable } from '../../src/structures/HashTable';

describe('HashTable', () => {
  it('sets, gets and overwrites', () => {
    const t = new HashTable<number>();
    t.set('a', 1);
    t.set('a', 2);
    expect(t.get('a')).toBe(2);
    expect(t.size).toBe(1);
    expect(t.has('a')).toBe(true);
    expect(t.get('zz')).toBeUndefined();
  });

  it('deletes keys, including in collision chains', () => {
    const t = new HashTable<number>(1, 100);
    ['a', 'b', 'c'].forEach((k, i) => t.set(k, i));
    expect(t.delete('b')).toBe(true);
    expect(t.delete('b')).toBe(false);
    expect(t.get('a')).toBe(0);
    expect(t.get('c')).toBe(2);
    expect(t.size).toBe(2);
  });

  it('resizes and keeps all entries', () => {
    const t = new HashTable<number>(2);
    for (let i = 0; i < 500; i++) t.set(`k${i}`, i);
    expect(t.bucketCount).toBeGreaterThan(2);
    expect(t.size).toBe(500);
    for (let i = 0; i < 500; i++) expect(t.get(`k${i}`)).toBe(i);
    expect(t.keys()).toHaveLength(500);
  });

  it('getOrSet only creates once', () => {
    const t = new HashTable<number[]>();
    let calls = 0;
    const mk = (): number[] => {
      calls++;
      return [];
    };
    t.getOrSet('x', mk).push(1);
    t.getOrSet('x', mk).push(2);
    expect(calls).toBe(1);
    expect(t.get('x')).toEqual([1, 2]);
    t.clear();
    expect(t.size).toBe(0);
  });
});
