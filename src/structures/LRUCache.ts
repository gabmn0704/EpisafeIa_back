interface Node<K, V> {
  key: K;
  value: V;
  expiresAt: number;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

/**
 * Caché LRU: Map para búsqueda O(1) + lista doblemente enlazada para el orden
 * de uso. Soporta TTL opcional por entrada.
 */
export class LRUCache<K, V> {
  private map = new Map<K, Node<K, V>>();
  private head: Node<K, V> | null = null; // más reciente
  private tail: Node<K, V> | null = null; // menos reciente
  hits = 0;
  misses = 0;

  constructor(
    readonly capacity: number,
    private readonly ttlMs = 0,
    private readonly now: () => number = Date.now,
  ) {
    if (capacity <= 0) throw new RangeError('capacity must be > 0');
  }

  get size(): number {
    return this.map.size;
  }

  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }
    if (node.expiresAt && node.expiresAt <= this.now()) {
      this.remove(node);
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.moveToFront(node);
    return node.value;
  }

  has(key: K): boolean {
    const node = this.map.get(key);
    return !!node && !(node.expiresAt && node.expiresAt <= this.now());
  }

  set(key: K, value: V): void {
    const expiresAt = this.ttlMs ? this.now() + this.ttlMs : 0;
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = expiresAt;
      this.moveToFront(existing);
      return;
    }
    const node: Node<K, V> = { key, value, expiresAt, prev: null, next: null };
    this.map.set(key, node);
    this.pushFront(node);
    if (this.map.size > this.capacity && this.tail) this.remove(this.tail);
  }

  delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.remove(node);
    return true;
  }

  clear(): void {
    this.map.clear();
    this.head = this.tail = null;
  }

  /** Claves de la más reciente a la menos reciente. */
  keys(): K[] {
    const out: K[] = [];
    for (let n = this.head; n; n = n.next) out.push(n.key);
    return out;
  }

  private pushFront(node: Node<K, V>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private unlink(node: Node<K, V>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
  }

  private moveToFront(node: Node<K, V>): void {
    if (this.head === node) return;
    this.unlink(node);
    this.pushFront(node);
  }

  private remove(node: Node<K, V>): void {
    this.unlink(node);
    this.map.delete(node.key);
  }
}
