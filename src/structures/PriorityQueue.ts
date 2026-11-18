import { MinHeap } from './MinHeap';

interface Entry<T> {
  value: T;
  priority: number;
  seq: number;
}

/**
 * Cola de prioridad (menor número = mayor prioridad) sobre un MinHeap.
 * Es estable: a igual prioridad sale primero el que entró antes.
 */
export class PriorityQueue<T> {
  private heap = new MinHeap<Entry<T>>((a, b) => a.priority - b.priority || a.seq - b.seq);
  private seq = 0;

  get size(): number {
    return this.heap.size;
  }

  isEmpty(): boolean {
    return this.heap.isEmpty();
  }

  enqueue(value: T, priority: number): void {
    this.heap.push({ value, priority, seq: this.seq++ });
  }

  dequeue(): T | undefined {
    return this.heap.pop()?.value;
  }

  peek(): T | undefined {
    return this.heap.peek()?.value;
  }

  /** Vacía la cola en orden de prioridad. */
  drain(): T[] {
    const out: T[] = [];
    while (!this.isEmpty()) out.push(this.dequeue() as T);
    return out;
  }
}
