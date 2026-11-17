import type { KeyCompare } from './BinarySearchTree';

interface AvlNode<K, V> {
  key: K;
  value: V;
  height: number;
  left: AvlNode<K, V> | null;
  right: AvlNode<K, V> | null;
}

const defaultCompare = <K>(a: K, b: K): number => (a < b ? -1 : a > b ? 1 : 0);

const h = <K, V>(n: AvlNode<K, V> | null): number => (n ? n.height : 0);

/** Árbol AVL auto-balanceado: inserción, borrado y rangos en O(log n + m). */
export class AVLTree<K, V> {
  private root: AvlNode<K, V> | null = null;
  private count = 0;

  constructor(private readonly compare: KeyCompare<K> = defaultCompare) {}

  get size(): number {
    return this.count;
  }

  height(): number {
    return h(this.root);
  }

  insert(key: K, value: V): void {
    this.root = this.insertNode(this.root, key, value);
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

  delete(key: K): boolean {
    const before = this.count;
    this.root = this.deleteNode(this.root, key);
    return this.count < before;
  }

  min(): [K, V] | undefined {
    if (!this.root) return undefined;
    const n = this.minNode(this.root);
    return [n.key, n.value];
  }

  max(): [K, V] | undefined {
    let cur = this.root;
    if (!cur) return undefined;
    while (cur.right) cur = cur.right;
    return [cur.key, cur.value];
  }

  /** Mayor clave estrictamente menor que key. */
  predecessor(key: K): [K, V] | undefined {
    let cur = this.root;
    let best: AvlNode<K, V> | null = null;
    while (cur) {
      if (this.compare(cur.key, key) < 0) {
        best = cur;
        cur = cur.right;
      } else cur = cur.left;
    }
    return best ? [best.key, best.value] : undefined;
  }

  /** Menor clave estrictamente mayor que key. */
  successor(key: K): [K, V] | undefined {
    let cur = this.root;
    let best: AvlNode<K, V> | null = null;
    while (cur) {
      if (this.compare(cur.key, key) > 0) {
        best = cur;
        cur = cur.left;
      } else cur = cur.right;
    }
    return best ? [best.key, best.value] : undefined;
  }

  inOrder(): [K, V][] {
    return this.range();
  }

  /** Entradas con from <= key <= to (límites opcionales). */
  range(from?: K, to?: K): [K, V][] {
    const out: [K, V][] = [];
    const walk = (n: AvlNode<K, V> | null): void => {
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

  static from<K, V>(entries: Iterable<[K, V]>, compare?: KeyCompare<K>): AVLTree<K, V> {
    const t = new AVLTree<K, V>(compare);
    for (const [k, v] of entries) t.insert(k, v);
    return t;
  }

  private minNode(n: AvlNode<K, V>): AvlNode<K, V> {
    while (n.left) n = n.left;
    return n;
  }

  private update(n: AvlNode<K, V>): void {
    n.height = 1 + Math.max(h(n.left), h(n.right));
  }

  private balanceFactor(n: AvlNode<K, V>): number {
    return h(n.left) - h(n.right);
  }

  private rotateRight(y: AvlNode<K, V>): AvlNode<K, V> {
    const x = y.left as AvlNode<K, V>;
    y.left = x.right;
    x.right = y;
    this.update(y);
    this.update(x);
    return x;
  }

  private rotateLeft(x: AvlNode<K, V>): AvlNode<K, V> {
    const y = x.right as AvlNode<K, V>;
    x.right = y.left;
    y.left = x;
    this.update(x);
    this.update(y);
    return y;
  }

  private rebalance(n: AvlNode<K, V>): AvlNode<K, V> {
    this.update(n);
    const bf = this.balanceFactor(n);
    if (bf > 1) {
      if (this.balanceFactor(n.left as AvlNode<K, V>) < 0) n.left = this.rotateLeft(n.left as AvlNode<K, V>);
      return this.rotateRight(n);
    }
    if (bf < -1) {
      if (this.balanceFactor(n.right as AvlNode<K, V>) > 0) n.right = this.rotateRight(n.right as AvlNode<K, V>);
      return this.rotateLeft(n);
    }
    return n;
  }

  private insertNode(n: AvlNode<K, V> | null, key: K, value: V): AvlNode<K, V> {
    if (!n) {
      this.count++;
      return { key, value, height: 1, left: null, right: null };
    }
    const c = this.compare(key, n.key);
    if (c < 0) n.left = this.insertNode(n.left, key, value);
    else if (c > 0) n.right = this.insertNode(n.right, key, value);
    else {
      n.value = value;
      return n;
    }
    return this.rebalance(n);
  }

  private deleteNode(n: AvlNode<K, V> | null, key: K): AvlNode<K, V> | null {
    if (!n) return null;
    const c = this.compare(key, n.key);
    if (c < 0) n.left = this.deleteNode(n.left, key);
    else if (c > 0) n.right = this.deleteNode(n.right, key);
    else {
      if (!n.left || !n.right) {
        this.count--;
        return n.left ?? n.right;
      }
      const succ = this.minNode(n.right);
      n.key = succ.key;
      n.value = succ.value;
      n.right = this.deleteNode(n.right, succ.key);
    }
    return this.rebalance(n);
  }
}
