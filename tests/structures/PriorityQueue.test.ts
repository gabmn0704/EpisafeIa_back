import { describe, expect, it } from 'vitest';
import { PriorityQueue } from '../../src/structures/PriorityQueue';

describe('PriorityQueue', () => {
  it('dequeues lowest priority number first', () => {
    const q = new PriorityQueue<string>();
    q.enqueue('c', 3);
    q.enqueue('a', 1);
    q.enqueue('b', 2);
    expect(q.peek()).toBe('a');
    expect(q.drain()).toEqual(['a', 'b', 'c']);
  });

  it('is stable for equal priorities', () => {
    const q = new PriorityQueue<string>();
    ['x', 'y', 'z'].forEach((v) => q.enqueue(v, 1));
    expect(q.drain()).toEqual(['x', 'y', 'z']);
  });

  it('returns undefined when empty', () => {
    const q = new PriorityQueue<number>();
    expect(q.dequeue()).toBeUndefined();
    expect(q.isEmpty()).toBe(true);
  });
});
