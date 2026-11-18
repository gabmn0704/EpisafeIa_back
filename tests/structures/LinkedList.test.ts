import { describe, expect, it } from 'vitest';
import { LinkedList } from '../../src/structures/LinkedList';

describe('LinkedList', () => {
  it('appends, prepends and iterates in order', () => {
    const l = new LinkedList<number>();
    l.append(2).append(3).prepend(1);
    expect(l.toArray()).toEqual([1, 2, 3]);
    expect(l.size).toBe(3);
    expect(l.peekFirst()).toBe(1);
    expect(l.peekLast()).toBe(3);
  });

  it('removes first and keeps tail consistent', () => {
    const l = LinkedList.from([1, 2]);
    expect(l.removeFirst()).toBe(1);
    expect(l.removeFirst()).toBe(2);
    expect(l.removeFirst()).toBeUndefined();
    l.append(9);
    expect(l.toArray()).toEqual([9]);
    expect(l.isEmpty()).toBe(false);
  });

  it('removes by predicate including head and tail', () => {
    const l = LinkedList.from([1, 2, 3, 4]);
    expect(l.remove((x) => x === 4)).toBe(true);
    expect(l.remove((x) => x === 1)).toBe(true);
    expect(l.remove((x) => x === 99)).toBe(false);
    l.append(5);
    expect(l.toArray()).toEqual([2, 3, 5]);
  });

  it('finds and reverses', () => {
    const l = LinkedList.from([1, 2, 3]);
    expect(l.find((x) => x > 1)).toBe(2);
    expect(l.reverse().toArray()).toEqual([3, 2, 1]);
    l.append(0);
    expect(l.toArray()).toEqual([3, 2, 1, 0]);
  });

  it('clears', () => {
    const l = LinkedList.from([1]);
    l.clear();
    expect(l.size).toBe(0);
    expect(l.peekFirst()).toBeUndefined();
  });
});
