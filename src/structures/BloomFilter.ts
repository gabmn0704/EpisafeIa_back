/**
 * Filtro de Bloom: pertenencia probabilística (sin falsos negativos, con una
 * tasa de falsos positivos configurable). Usa doble hashing (FNV-1a + djb2).
 */
export class BloomFilter {
  private readonly bits: Uint8Array;
  readonly bitSize: number;
  readonly hashCount: number;
  private inserted = 0;

  constructor(expectedItems = 10_000, falsePositiveRate = 0.01) {
    const m = Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / Math.LN2 ** 2);
    this.bitSize = Math.max(8, m);
    this.hashCount = Math.max(1, Math.round((this.bitSize / expectedItems) * Math.LN2));
    this.bits = new Uint8Array(Math.ceil(this.bitSize / 8));
  }

  get count(): number {
    return this.inserted;
  }

  add(item: string): void {
    for (const idx of this.indexes(item)) {
      this.bits[idx >> 3] = (this.bits[idx >> 3] as number) | (1 << (idx & 7));
    }
    this.inserted++;
  }

  /** false => seguro que NO está; true => probablemente está. */
  mightContain(item: string): boolean {
    for (const idx of this.indexes(item)) {
      if (((this.bits[idx >> 3] as number) & (1 << (idx & 7))) === 0) return false;
    }
    return true;
  }

  /** Estimación de la tasa de falsos positivos actual. */
  estimatedFalsePositiveRate(): number {
    return (1 - Math.exp((-this.hashCount * this.inserted) / this.bitSize)) ** this.hashCount;
  }

  private indexes(item: string): number[] {
    let h1 = 0x811c9dc5;
    let h2 = 5381;
    for (let i = 0; i < item.length; i++) {
      const c = item.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = (Math.imul(h2, 33) + c) >>> 0;
    }
    const out: number[] = [];
    for (let i = 0; i < this.hashCount; i++) out.push(((h1 + Math.imul(i, h2 | 1)) >>> 0) % this.bitSize);
    return out;
  }
}
