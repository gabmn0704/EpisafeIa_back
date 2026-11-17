/**
 * Árbol de segmentos genérico: consulta por rango con una operación asociativa
 * (suma, mínimo, máximo...) y actualización puntual en O(log n).
 */
export class SegmentTree<T> {
  private readonly size: number;
  private readonly tree: T[];

  constructor(
    values: T[],
    private readonly combine: (a: T, b: T) => T,
    private readonly identity: T,
  ) {
    this.size = Math.max(1, values.length);
    this.tree = new Array<T>(2 * this.size).fill(identity);
    for (let i = 0; i < values.length; i++) this.tree[this.size + i] = values[i] as T;
    for (let i = this.size - 1; i > 0; i--) {
      this.tree[i] = combine(this.tree[2 * i] as T, this.tree[2 * i + 1] as T);
    }
  }

  static sum(values: number[]): SegmentTree<number> {
    return new SegmentTree(values, (a, b) => a + b, 0);
  }

  static min(values: number[]): SegmentTree<number> {
    return new SegmentTree(values, Math.min, Infinity);
  }

  static max(values: number[]): SegmentTree<number> {
    return new SegmentTree(values, Math.max, -Infinity);
  }

  get length(): number {
    return this.size;
  }

  update(i: number, value: T): void {
    if (i < 0 || i >= this.size) throw new RangeError(`index ${i} out of range`);
    let p = i + this.size;
    this.tree[p] = value;
    for (p >>= 1; p >= 1; p >>= 1) this.tree[p] = this.combine(this.tree[2 * p] as T, this.tree[2 * p + 1] as T);
  }

  /** Consulta sobre [l, r] inclusive. */
  query(l: number, r: number): T {
    if (l < 0 || r >= this.size || l > r) throw new RangeError(`invalid range [${l}, ${r}]`);
    let resL = this.identity;
    let resR = this.identity;
    let lo = l + this.size;
    let hi = r + this.size + 1;
    while (lo < hi) {
      if (lo & 1) resL = this.combine(resL, this.tree[lo++] as T);
      if (hi & 1) resR = this.combine(this.tree[--hi] as T, resR);
      lo >>= 1;
      hi >>= 1;
    }
    return this.combine(resL, resR);
  }
}
