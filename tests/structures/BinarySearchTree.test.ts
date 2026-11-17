import { describe, expect, it } from 'vitest';
import { BinarySearchTree } from '../../src/structures/BinarySearchTree';

describe('BinarySearchTree', () => {
  const build = () => {
    const t = new BinarySearchTree<number, string>();
    [50, 30, 70, 20, 40, 60, 80].forEach((k) => t.insert(k, 'v' + k));
    return t;
  };

  it('inserts, finds and overwrites', () => {
    const t = build();
    expect(t.size).toBe(7);
    expect(t.get(40)).toBe('v40');
    t.insert(40, 'new');
    expect(t.get(40)).toBe('new');
    expect(t.size).toBe(7);
    expect(t.has(999)).toBe(false);
  });

  it('returns sorted traversal, min and max', () => {
    const t = build();
    expect(t.inOrder().map(([k]) => k)).toEqual([20, 30, 40, 50, 60, 70, 80]);
    expect(t.min()?.[0]).toBe(20);
    expect(t.max()?.[0]).toBe(80);
    expect(new BinarySearchTree<number, number>().min()).toBeUndefined();
  });

  it('answers range queries', () => {
    const t = build();
    expect(t.range(35, 65).map(([k]) => k)).toEqual([40, 50, 60]);
    expect(t.range(undefined, 30).map(([k]) => k)).toEqual([20, 30]);
    expect(t.range(70).map(([k]) => k)).toEqual([70, 80]);
  });

  it('deletes leaves, one-child and two-children nodes', () => {
    const t = build();
    expect(t.delete(20)).toBe(true);
    expect(t.delete(30)).toBe(true);
    expect(t.delete(50)).toBe(true);
    expect(t.delete(1234)).toBe(false);
    expect(t.inOrder().map(([k]) => k)).toEqual([40, 60, 70, 80]);
    expect(t.size).toBe(4);
  });

  it('degenerates to a list on sorted input', () => {
    const t = new BinarySearchTree<number, number>();
    for (let i = 0; i < 50; i++) t.insert(i, i);
    expect(t.height()).toBe(50);
  });
});
