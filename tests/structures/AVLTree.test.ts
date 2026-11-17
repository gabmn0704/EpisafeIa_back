import { describe, expect, it } from 'vitest';
import { AVLTree } from '../../src/structures/AVLTree';

describe('AVLTree', () => {
  it('stays balanced on sorted inserts', () => {
    const t = new AVLTree<number, number>();
    for (let i = 1; i <= 1023; i++) t.insert(i, i);
    expect(t.size).toBe(1023);
    expect(t.height()).toBeLessThanOrEqual(11);
  });

  it('performs all four rotations', () => {
    for (const order of [[3, 2, 1], [1, 2, 3], [3, 1, 2], [1, 3, 2]]) {
      const t = AVLTree.from(order.map((k) => [k, k] as [number, number]));
      expect(t.height()).toBe(2);
      expect(t.inOrder().map(([k]) => k)).toEqual([1, 2, 3]);
    }
  });

  it('keeps balance and order after deletions', () => {
    const t = new AVLTree<number, number>();
    for (let i = 0; i < 200; i++) t.insert(i, i);
    for (let i = 0; i < 200; i += 2) expect(t.delete(i)).toBe(true);
    expect(t.delete(0)).toBe(false);
    expect(t.size).toBe(100);
    expect(t.inOrder().map(([k]) => k)).toEqual(Array.from({ length: 100 }, (_, i) => 2 * i + 1));
    expect(t.height()).toBeLessThanOrEqual(9);
  });

  it('answers range, predecessor and successor queries', () => {
    const t = AVLTree.from([10, 20, 30, 40, 50].map((k) => [k, 'v' + k] as [number, string]));
    expect(t.range(15, 45).map(([k]) => k)).toEqual([20, 30, 40]);
    expect(t.predecessor(30)?.[0]).toBe(20);
    expect(t.successor(30)?.[0]).toBe(40);
    expect(t.predecessor(10)).toBeUndefined();
    expect(t.successor(50)).toBeUndefined();
    expect(t.min()?.[0]).toBe(10);
    expect(t.max()?.[0]).toBe(50);
  });

  it('supports string keys with a custom comparator', () => {
    const t = new AVLTree<string, number>((a, b) => a.localeCompare(b));
    t.insert('2024-03-01', 1);
    t.insert('2024-01-01', 2);
    expect(t.get('2024-01-01')).toBe(2);
    expect(t.inOrder()[0]?.[0]).toBe('2024-01-01');
  });
});
