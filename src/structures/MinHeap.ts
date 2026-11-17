export type Comparator<T> = (a: T, b: T) => number;

/** Montículo binario mínimo según el comparador dado. */
export class MinHeap<T> {
  private data: T[] = [];

  constructor(private readonly compare: Comparator<T> = (a, b) => (a < b ? -1 : a > b ? 1 : 0)) {}

  get size(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  /** O(log n) */
  push(value: T): void {
    this.data.push(value);
    this.siftUp(this.data.length - 1);
  }

  /** O(log n) */
  pop(): T | undefined {
    const n = this.data.length;
    if (n === 0) return undefined;
    const top = this.data[0] as T;
    const last = this.data.pop() as T;
    if (n > 1) {
      this.data[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  /** Devuelve los k menores según el comparador. */
  static topK<T>(items: Iterable<T>, k: number, compare: Comparator<T>): T[] {
    const heap = new MinHeap<T>(compare);
    for (const i of items) heap.push(i);
    const out: T[] = [];
    while (out.length < k && !heap.isEmpty()) out.push(heap.pop() as T);
    return out;
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.data[i] as T, this.data[parent] as T) >= 0) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(i: number): void {
    const n = this.data.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < n && this.compare(this.data[l] as T, this.data[smallest] as T) < 0) smallest = l;
      if (r < n && this.compare(this.data[r] as T, this.data[smallest] as T) < 0) smallest = r;
      if (smallest === i) return;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const t = this.data[a] as T;
    this.data[a] = this.data[b] as T;
    this.data[b] = t;
  }
}
