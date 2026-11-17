/** Árbol de Fenwick (BIT): suma de prefijos y rangos con actualización en O(log n). */
export class FenwickTree {
  private readonly tree: number[];

  constructor(readonly length: number) {
    this.tree = new Array<number>(length + 1).fill(0);
  }

  static from(values: number[]): FenwickTree {
    const f = new FenwickTree(values.length);
    values.forEach((v, i) => f.add(i, v));
    return f;
  }

  /** Suma `delta` en la posición i (0-based). */
  add(i: number, delta: number): void {
    this.check(i);
    for (let x = i + 1; x <= this.length; x += x & -x) this.tree[x] = (this.tree[x] as number) + delta;
  }

  /** Suma de [0, i] inclusive. */
  prefixSum(i: number): number {
    if (i < 0) return 0;
    this.check(i);
    let s = 0;
    for (let x = i + 1; x > 0; x -= x & -x) s += this.tree[x] as number;
    return s;
  }

  /** Suma de [l, r] inclusive. */
  rangeSum(l: number, r: number): number {
    if (l > r) return 0;
    return this.prefixSum(r) - this.prefixSum(l - 1);
  }

  /** Valor puntual. */
  get(i: number): number {
    return this.rangeSum(i, i);
  }

  private check(i: number): void {
    if (!Number.isInteger(i) || i < 0 || i >= this.length) throw new RangeError(`index ${i} out of range`);
  }
}
