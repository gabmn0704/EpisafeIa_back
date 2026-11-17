export interface BstNode<K, V> {
  key: K;
  value: V;
  left: BstNode<K, V> | null;
  right: BstNode<K, V> | null;
}

export type KeyCompare<K> = (a: K, b: K) => number;

const defaultCompare = <K>(a: K, b: K): number => (a < b ? -1 : a > b ? 1 : 0);

/** Árbol binario de búsqueda (sin balanceo) con consultas por rango. */
export class BinarySearchTree<K, V> {
  protected root: BstNode<K, V> | null = null;
  protected count = 0;

  constructor(protected readonly compare: KeyCompare<K> = defaultCompare) {}

  get size(): number {
    return this.count;
  }

  insert(key: K, value: V): void {
    const node: BstNode<K, V> = { key, value, left: null, right: null };
    if (!this.root) {
      this.root = node;
      this.count++;
      return;
    }
    let cur = this.root;
    for (;;) {
      const c = this.compare(key, cur.key);
      if (c === 0) {
        cur.value = value;
        return;
      }
      const side = c < 0 ? 'left' : 'right';
      const child = cur[side];
      if (!child) {
        cur[side] = node;
        this.count++;
        return;
      }
      cur = child;
    }
  }

  get(key: K): V | undefined {
    let cur = this.root;
    while (cur) {
      const c = this.compare(key, cur.key);
      if (c === 0) return cur.value;
      cur = c < 0 ? cur.left : cur.right;
    }
    return undefined;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  min(): [K, V] | undefined {
    let cur = this.root;
    if (!cur) return undefined;
    while (cur.left) cur = cur.left;
    return [cur.key, cur.value];
  }

  max(): [K, V] | undefined {
    let cur = this.root;
    if (!cur) return undefined;
    while (cur.right) cur = cur.right;
    return [cur.key, cur.value];
  }

  height(): number {
    const h = (n: BstNode<K, V> | null): number => (n ? 1 + Math.max(h(n.left), h(n.right)) : 0);
    return h(this.root);
  }

  delete(key: K): boolean {
    const before = this.count;
    this.root = this.deleteNode(this.root, key);
    return this.count < before;
  }

  private deleteNode(node: BstNode<K, V> | null, key: K): BstNode<K, V> | null {
    if (!node) return null;
    const c = this.compare(key, node.key);
    if (c < 0) node.left = this.deleteNode(node.left, key);
    else if (c > 0) node.right = this.deleteNode(node.right, key);
    else {
      if (!node.left || !node.right) {
        this.count--;
        return node.left ?? node.right;
      }
      let succ = node.right;
      while (succ.left) succ = succ.left;
      node.key = succ.key;
      node.value = succ.value;
      node.right = this.deleteNode(node.right, succ.key);
    }
    return node;
  }

  /** Recorrido en orden (claves ascendentes). */
  inOrder(): [K, V][] {
    return this.range();
  }

  /** Entradas con from <= key <= to (límites opcionales), en orden. */
  range(from?: K, to?: K): [K, V][] {
    const out: [K, V][] = [];
    const walk = (n: BstNode<K, V> | null): void => {
      if (!n) return;
      const gteFrom = from === undefined || this.compare(n.key, from) >= 0;
      const lteTo = to === undefined || this.compare(n.key, to) <= 0;
      if (gteFrom) walk(n.left);
      if (gteFrom && lteTo) out.push([n.key, n.value]);
      if (lteTo) walk(n.right);
    };
    walk(this.root);
    return out;
  }
}
