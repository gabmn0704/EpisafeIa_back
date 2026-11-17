interface Bucket<V> {
  key: string;
  value: V;
  next: Bucket<V> | null;
}

/** Tabla hash con encadenamiento separado y redimensionado dinámico (FNV-1a). */
export class HashTable<V> {
  private buckets: (Bucket<V> | null)[];
  private count = 0;

  constructor(
    private capacity = 16,
    private readonly maxLoad = 0.75,
  ) {
    this.buckets = new Array<Bucket<V> | null>(capacity).fill(null);
  }

  get size(): number {
    return this.count;
  }

  get bucketCount(): number {
    return this.capacity;
  }

  private static hash(key: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  private index(key: string): number {
    return HashTable.hash(key) % this.capacity;
  }

  set(key: string, value: V): void {
    const idx = this.index(key);
    for (let b = this.buckets[idx]; b; b = b.next) {
      if (b.key === key) {
        b.value = value;
        return;
      }
    }
    this.buckets[idx] = { key, value, next: this.buckets[idx] ?? null };
    this.count++;
    if (this.count / this.capacity > this.maxLoad) this.resize(this.capacity * 2);
  }

  get(key: string): V | undefined {
    for (let b = this.buckets[this.index(key)]; b; b = b.next) if (b.key === key) return b.value;
    return undefined;
  }

  has(key: string): boolean {
    for (let b = this.buckets[this.index(key)]; b; b = b.next) if (b.key === key) return true;
    return false;
  }

  delete(key: string): boolean {
    const idx = this.index(key);
    let prev: Bucket<V> | null = null;
    for (let b = this.buckets[idx]; b; b = b.next) {
      if (b.key === key) {
        if (prev) prev.next = b.next;
        else this.buckets[idx] = b.next;
        this.count--;
        return true;
      }
      prev = b;
    }
    return false;
  }

  /** Devuelve el valor existente o lo crea con la fábrica. */
  getOrSet(key: string, factory: () => V): V {
    const found = this.get(key);
    if (found !== undefined) return found;
    const v = factory();
    this.set(key, v);
    return v;
  }

  clear(): void {
    this.buckets = new Array<Bucket<V> | null>(this.capacity).fill(null);
    this.count = 0;
  }

  *entries(): IterableIterator<[string, V]> {
    for (const head of this.buckets) for (let b = head; b; b = b.next) yield [b.key, b.value];
  }

  keys(): string[] {
    return [...this.entries()].map(([k]) => k);
  }

  private resize(newCap: number): void {
    const old = this.buckets;
    this.capacity = newCap;
    this.buckets = new Array<Bucket<V> | null>(newCap).fill(null);
    for (const head of old) {
      let b = head;
      while (b) {
        const next: Bucket<V> | null = b.next;
        const idx = this.index(b.key);
        b.next = this.buckets[idx] ?? null;
        this.buckets[idx] = b;
        b = next;
      }
    }
  }
}
