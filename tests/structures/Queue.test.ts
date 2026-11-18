import { describe, expect, it } from 'vitest';
import { Queue } from '../../src/structures/Queue';

describe('Queue', () => {
  it('is FIFO', () => {
    const q = new Queue<string>();
    q.enqueue('a');
    q.enqueue('b');
    expect(q.peek()).toBe('a');
    expect(q.dequeue()).toBe('a');
    expect(q.dequeue()).toBe('b');
    expect(q.dequeue()).toBeUndefined();
  });

  it('iterates without consuming', () => {
    const q = new Queue<number>();
    [1, 2, 3].forEach((n) => q.enqueue(n));
    expect([...q]).toEqual([1, 2, 3]);
    expect(q.size).toBe(3);
    q.clear();
    expect(q.isEmpty()).toBe(true);
  });
});
