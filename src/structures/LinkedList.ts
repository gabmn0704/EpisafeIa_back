export interface ListNode<T> {
  value: T;
  next: ListNode<T> | null;
}

/** Lista simplemente enlazada con referencia a cabeza y cola. */
export class LinkedList<T> implements Iterable<T> {
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;
  private count = 0;

  get size(): number {
    return this.count;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  /** O(1) */
  append(value: T): this {
    const node: ListNode<T> = { value, next: null };
    if (this.tail) this.tail.next = node;
    else this.head = node;
    this.tail = node;
    this.count++;
    return this;
  }

  /** O(1) */
  prepend(value: T): this {
    const node: ListNode<T> = { value, next: this.head };
    this.head = node;
    if (!this.tail) this.tail = node;
    this.count++;
    return this;
  }

  /** O(1) */
  removeFirst(): T | undefined {
    if (!this.head) return undefined;
    const node = this.head;
    this.head = node.next;
    if (!this.head) this.tail = null;
    this.count--;
    return node.value;
  }

  peekFirst(): T | undefined {
    return this.head?.value;
  }

  peekLast(): T | undefined {
    return this.tail?.value;
  }

  /** O(n). Elimina la primera coincidencia del predicado. */
  remove(predicate: (value: T) => boolean): boolean {
    let prev: ListNode<T> | null = null;
    let cur = this.head;
    while (cur) {
      if (predicate(cur.value)) {
        if (prev) prev.next = cur.next;
        else this.head = cur.next;
        if (cur === this.tail) this.tail = prev;
        this.count--;
        return true;
      }
      prev = cur;
      cur = cur.next;
    }
    return false;
  }

  find(predicate: (value: T) => boolean): T | undefined {
    for (const v of this) if (predicate(v)) return v;
    return undefined;
  }

  /** Invierte la lista in situ en O(n). */
  reverse(): this {
    let prev: ListNode<T> | null = null;
    let cur = this.head;
    this.tail = this.head;
    while (cur) {
      const next: ListNode<T> | null = cur.next;
      cur.next = prev;
      prev = cur;
      cur = next;
    }
    this.head = prev;
    return this;
  }

  clear(): void {
    this.head = null;
    this.tail = null;
    this.count = 0;
  }

  toArray(): T[] {
    return [...this];
  }

  static from<T>(items: Iterable<T>): LinkedList<T> {
    const list = new LinkedList<T>();
    for (const i of items) list.append(i);
    return list;
  }

  *[Symbol.iterator](): Iterator<T> {
    let cur = this.head;
    while (cur) {
      yield cur.value;
      cur = cur.next;
    }
  }
}
