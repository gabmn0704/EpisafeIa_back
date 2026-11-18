import { describe, expect, it } from 'vitest';
import { Stack } from '../../src/structures/Stack';

describe('Stack', () => {
  it('is LIFO', () => {
    const s = new Stack<number>();
    s.push(1);
    s.push(2);
    expect(s.peek()).toBe(2);
    expect(s.pop()).toBe(2);
    expect(s.pop()).toBe(1);
    expect(s.pop()).toBeUndefined();
    expect(s.isEmpty()).toBe(true);
  });

  it('drops the oldest item when over capacity', () => {
    const s = new Stack<number>(2);
    [1, 2, 3].forEach((n) => s.push(n));
    expect(s.size).toBe(2);
    expect(s.toArray()).toEqual([3, 2]);
  });

  it('clears', () => {
    const s = new Stack<number>();
    s.push(1);
    s.clear();
    expect(s.size).toBe(0);
  });
});
