import { randomUUID } from 'node:crypto';
import type { NewRow, Query, Table } from '../Table';

type Cmp = string | number | null | undefined;

const cmp = (a: Cmp, b: Cmp): number => {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return a < b ? -1 : 1;
};

const sameValue = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
};

/** Implementación en memoria de Table. Las filas se clonan al entrar y salir. */
export class MemoryTable<T extends { id: string }> implements Table<T> {
  private rows = new Map<string, T>();

  async insert(row: NewRow<T>): Promise<T> {
    const full = { ...row, id: row.id ?? randomUUID() } as T;
    this.rows.set(full.id, structuredClone(full));
    return structuredClone(full);
  }

  async get(id: string): Promise<T | undefined> {
    const r = this.rows.get(id);
    return r ? structuredClone(r) : undefined;
  }

  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | undefined> {
    const cur = this.rows.get(id);
    if (!cur) return undefined;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const next = { ...cur, ...clean } as T;
    this.rows.set(id, next);
    return structuredClone(next);
  }

  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }

  async find(query: Query<T> = {}): Promise<T[]> {
    let out = [...this.rows.values()].filter((r) => this.matches(r, query));
    if (query.orderBy) {
      const key = query.orderBy;
      const dir = query.desc ? -1 : 1;
      out.sort((a, b) => dir * cmp(a[key] as Cmp, b[key] as Cmp));
    }
    const start = query.offset ?? 0;
    out = out.slice(start, query.limit === undefined ? undefined : start + query.limit);
    return out.map((r) => structuredClone(r));
  }

  async count(query: Query<T> = {}): Promise<number> {
    return [...this.rows.values()].filter((r) => this.matches(r, query)).length;
  }

  async findOne(query: Query<T>): Promise<T | undefined> {
    return (await this.find({ ...query, limit: 1 }))[0];
  }

  private matches(row: T, q: Query<T>): boolean {
    if (q.where) {
      for (const [k, v] of Object.entries(q.where)) {
        if (v !== undefined && !sameValue((row as Record<string, unknown>)[k], v)) return false;
      }
    }
    if (q.range) {
      const val = row[q.range.field] as Cmp;
      if (val === null || val === undefined) return false;
      if (q.range.from !== undefined && cmp(val, q.range.from) < 0) return false;
      if (q.range.to !== undefined && cmp(val, q.range.to) > 0) return false;
    }
    return true;
  }
}
