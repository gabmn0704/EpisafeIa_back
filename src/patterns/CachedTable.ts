import { LRUCache } from '../structures/LRUCache';
import type { NewRow, Query, Table } from '../repositories/Table';

/**
 * Patrón Proxy: mismo contrato que Table, pero intercepta las lecturas por id
 * con una caché LRU y la invalida en escrituras. Consultas complejas pasan directo.
 */
export class CachedTable<T extends { id: string }> implements Table<T> {
  private readonly cache: LRUCache<string, T>;

  constructor(
    private readonly inner: Table<T>,
    capacity = 500,
    ttlMs = 60_000,
  ) {
    this.cache = new LRUCache<string, T>(capacity, ttlMs);
  }

  get stats(): { hits: number; misses: number; size: number } {
    return { hits: this.cache.hits, misses: this.cache.misses, size: this.cache.size };
  }

  async insert(row: NewRow<T>): Promise<T> {
    const created = await this.inner.insert(row);
    this.cache.set(created.id, created);
    return structuredClone(created);
  }

  async get(id: string): Promise<T | undefined> {
    const hit = this.cache.get(id);
    if (hit) return structuredClone(hit);
    const row = await this.inner.get(id);
    if (row) this.cache.set(id, row);
    return row ? structuredClone(row) : undefined;
  }

  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | undefined> {
    const updated = await this.inner.update(id, patch);
    if (updated) this.cache.set(id, updated);
    else this.cache.delete(id);
    return updated ? structuredClone(updated) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    this.cache.delete(id);
    return this.inner.delete(id);
  }

  find(query?: Query<T>): Promise<T[]> {
    return this.inner.find(query);
  }

  count(query?: Query<T>): Promise<number> {
    return this.inner.count(query);
  }

  findOne(query: Query<T>): Promise<T | undefined> {
    return this.inner.findOne(query);
  }
}
