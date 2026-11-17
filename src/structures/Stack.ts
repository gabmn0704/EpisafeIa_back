/** Pila LIFO con límite opcional (descarta lo más antiguo al desbordar). */
export class Stack<T> {
  private items: T[] = [];

  constructor(private readonly maxSize = Infinity) {}

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  push(value: T): void {
    this.items.push(value);
    if (this.items.length > this.maxSize) this.items.shift();
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  clear(): void {
    this.items = [];
  }

  /** Del más reciente al más antiguo. */
  toArray(): T[] {
    return [...this.items].reverse();
  }
}
