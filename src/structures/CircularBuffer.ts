/** Buffer circular de capacidad fija: al llenarse sobrescribe lo más antiguo. */
export class CircularBuffer<T> implements Iterable<T> {
  private buf: (T | undefined)[];
  private start = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError('capacity must be a positive integer');
    this.buf = new Array<T | undefined>(capacity);
  }

  get size(): number {
    return this.count;
  }

  isFull(): boolean {
    return this.count === this.capacity;
  }

  /** O(1). Devuelve el elemento desplazado si el buffer estaba lleno. */
  push(value: T): T | undefined {
    let evicted: T | undefined;
    if (this.count < this.capacity) {
      this.buf[(this.start + this.count) % this.capacity] = value;
      this.count++;
    } else {
      evicted = this.buf[this.start];
      this.buf[this.start] = value;
      this.start = (this.start + 1) % this.capacity;
    }
    return evicted;
  }

  /** Índice 0 = más antiguo. */
  at(index: number): T | undefined {
    if (index < 0 || index >= this.count) return undefined;
    return this.buf[(this.start + index) % this.capacity];
  }

  latest(): T | undefined {
    return this.at(this.count - 1);
  }

  /** Últimos n elementos (orden cronológico). */
  last(n: number): T[] {
    const from = Math.max(0, this.count - n);
    const out: T[] = [];
    for (let i = from; i < this.count; i++) out.push(this.at(i) as T);
    return out;
  }

  filter(predicate: (v: T) => boolean): T[] {
    return this.toArray().filter(predicate);
  }

  clear(): void {
    this.buf = new Array<T | undefined>(this.capacity);
    this.start = 0;
    this.count = 0;
  }

  toArray(): T[] {
    return this.last(this.count);
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.count; i++) yield this.at(i) as T;
  }
}
