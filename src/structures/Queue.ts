import { LinkedList } from './LinkedList';

/** Cola FIFO respaldada por una lista enlazada (enqueue/dequeue O(1)). */
export class Queue<T> implements Iterable<T> {
  private list = new LinkedList<T>();

  get size(): number {
    return this.list.size;
  }

  isEmpty(): boolean {
    return this.list.isEmpty();
  }

  enqueue(value: T): void {
    this.list.append(value);
  }

  dequeue(): T | undefined {
    return this.list.removeFirst();
  }

  peek(): T | undefined {
    return this.list.peekFirst();
  }

  clear(): void {
    this.list.clear();
  }

  toArray(): T[] {
    return this.list.toArray();
  }

  [Symbol.iterator](): Iterator<T> {
    return this.list[Symbol.iterator]();
  }
}
