import { describe, expect, it } from 'vitest';
import { LRUCache } from '../../src/structures/LRUCache';

describe('LRUCache', () => {
  it('evicts the least recently used entry', () => {
    const c = new LRUCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a');
    c.set('c', 3);
    expect(c.has('b')).toBe(false);
    expect(c.get('a')).toBe(1);
    expect(c.keys()).toEqual(['a', 'c']);
  });

  it('updates existing keys and moves them to front', () => {
    const c = new LRUCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 10);
    c.set('c', 3);
    expect(c.get('a')).toBe(10);
    expect(c.get('b')).toBeUndefined();
  });

  it('tracks hits and misses', () => {
    const c = new LRUCache<string, number>(1);
    c.set('a', 1);
    c.get('a');
    c.get('x');
    expect([c.hits, c.misses]).toEqual([1, 1]);
  });

  it('expires entries by TTL', () => {
    let now = 1000;
    const c = new LRUCache<string, number>(5, 100, () => now);
    c.set('a', 1);
    now = 1050;
    expect(c.get('a')).toBe(1);
    now = 1200;
    expect(c.has('a')).toBe(false);
    expect(c.get('a')).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it('deletes and clears', () => {
    const c = new LRUCache<string, number>(3);
    c.set('a', 1);
    c.set('b', 2);
    expect(c.delete('a')).toBe(true);
    expect(c.delete('a')).toBe(false);
    c.clear();
    expect(c.size).toBe(0);
  });

  it('rejects zero capacity', () => {
    expect(() => new LRUCache(0)).toThrow(RangeError);
  });
});
