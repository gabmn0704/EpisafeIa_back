export interface DNode<T> {
  value: T;
  prev: DNode<T> | null;
  next: DNode<T> | null;
}

/**
 * Lista doblemente enlazada con cursor. Se usa para navegar el historial de
 * crisis (anterior / siguiente) en O(1).
 */
export class DoublyLinkedList<T> implements Iterable<T> {
  private head: DNode<T> | null = null;
  private tail: DNode<T> | null = null;
  private current: DNode<T> | null = null;
  private count = 0;

  get size(): number {
    return this.count;
  }

  append(value: T): DNode<T> {
    const node: DNode<T> = { value, prev: this.tail, next: null };
    if (this.tail) this.tail.next = node;
    else this.head = node;
    this.tail = node;
    this.count++;
    return node;
  }

  prepend(value: T): DNode<T> {
    const node: DNode<T> = { value, prev: null, next: this.head };
    if (this.head) this.head.prev = node;
    else this.tail = node;
    this.head = node;
    this.count++;
    return node;
  }

  removeNode(node: DNode<T>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    if (this.current === node) this.current = node.next ?? node.prev;
    node.prev = null;
    node.next = null;
    this.count--;
  }

  findNode(predicate: (value: T) => boolean): DNode<T> | null {
    let cur = this.head;
    while (cur) {
      if (predicate(cur.value)) return cur;
      cur = cur.next;
    }
    return null;
  }

  /** Coloca el cursor en el primer nodo que cumpla el predicado. */
  moveTo(predicate: (value: T) => boolean): T | undefined {
    const node = this.findNode(predicate);
    this.current = node;
    return node?.value;
  }

  get currentValue(): T | undefined {
    return this.current?.value;
  }

  hasPrevious(): boolean {
    return !!this.current?.prev;
  }

  hasNext(): boolean {
    return !!this.current?.next;
  }

  previous(): T | undefined {
    if (this.current?.prev) this.current = this.current.prev;
    return this.current?.value;
  }

  next(): T | undefined {
    if (this.current?.next) this.current = this.current.next;
    return this.current?.value;
  }

  peekPrevious(): T | undefined {
    return this.current?.prev?.value;
  }

  peekNext(): T | undefined {
    return this.current?.next?.value;
  }

  toArray(): T[] {
    return [...this];
  }

  toArrayReversed(): T[] {
    const out: T[] = [];
    let cur = this.tail;
    while (cur) {
      out.push(cur.value);
      cur = cur.prev;
    }
    return out;
  }

  static from<T>(items: Iterable<T>): DoublyLinkedList<T> {
    const l = new DoublyLinkedList<T>();
    for (const i of items) l.append(i);
    return l;
  }

  *[Symbol.iterator](): Iterator<T> {
    let cur = this.head;
    while (cur) {
      yield cur.value;
      cur = cur.next;
    }
  }
}
