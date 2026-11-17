import type { Pool } from 'pg';
import type { NewRow, Query, Table } from '../Table';

const toSnake = (s: string): string => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const toCamel = (s: string): string => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export interface PgTableOptions {
  /** Columnas jsonb (se serializan explícitamente para soportar arreglos). */
  jsonColumns?: string[];
}

/** Implementación PostgreSQL de Table con SQL parametrizado (sin interpolar valores). */
export class PgTable<T extends { id: string }> implements Table<T> {
  private readonly json: Set<string>;

  constructor(
    private readonly pool: Pick<Pool, 'query'>,
    private readonly table: string,
    opts: PgTableOptions = {},
  ) {
    if (!/^[a-z_]+$/.test(table)) throw new Error('invalid table name');
    this.json = new Set(opts.jsonColumns ?? []);
  }

  private col(field: string): string {
    const c = toSnake(field);
    if (!/^[a-z0-9_]+$/.test(c)) throw new Error('invalid column name');
    return c;
  }

  private param(field: string, value: unknown): unknown {
    return this.json.has(field) && value !== null && value !== undefined ? JSON.stringify(value) : value;
  }

  private mapRow(row: Record<string, unknown>): T {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v instanceof Date ? v.toISOString() : v;
    return out as T;
  }

  private buildWhere(q: Query<T>, values: unknown[]): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(q.where ?? {})) {
      if (v === undefined) continue;
      if (v === null) parts.push(`${this.col(k)} IS NULL`);
      else {
        values.push(v);
        parts.push(`${this.col(k)} = $${values.length}`);
      }
    }
    if (q.range) {
      const c = this.col(String(q.range.field));
      if (q.range.from !== undefined) {
        values.push(q.range.from);
        parts.push(`${c} >= $${values.length}`);
      }
      if (q.range.to !== undefined) {
        values.push(q.range.to);
        parts.push(`${c} <= $${values.length}`);
      }
    }
    return parts.length ? ` WHERE ${parts.join(' AND ')}` : '';
  }

  async insert(row: NewRow<T>): Promise<T> {
    const entries = Object.entries(row).filter(([, v]) => v !== undefined);
    const cols = entries.map(([k]) => this.col(k));
    const values = entries.map(([k, v]) => this.param(k, v));
    const sql = cols.length
      ? `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`
      : `INSERT INTO ${this.table} DEFAULT VALUES RETURNING *`;
    const res = await this.pool.query(sql, values);
    return this.mapRow(res.rows[0] as Record<string, unknown>);
  }

  async get(id: string): Promise<T | undefined> {
    const res = await this.pool.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
    return res.rows[0] ? this.mapRow(res.rows[0] as Record<string, unknown>) : undefined;
  }

  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | undefined> {
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.get(id);
    const sets = entries.map(([k], i) => `${this.col(k)} = $${i + 1}`);
    const values = entries.map(([k, v]) => this.param(k, v));
    values.push(id);
    const res = await this.pool.query(
      `UPDATE ${this.table} SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return res.rows[0] ? this.mapRow(res.rows[0] as Record<string, unknown>) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async find(query: Query<T> = {}): Promise<T[]> {
    const values: unknown[] = [];
    let sql = `SELECT * FROM ${this.table}${this.buildWhere(query, values)}`;
    if (query.orderBy) sql += ` ORDER BY ${this.col(String(query.orderBy))} ${query.desc ? 'DESC' : 'ASC'}`;
    if (query.limit !== undefined) {
      values.push(query.limit);
      sql += ` LIMIT $${values.length}`;
    }
    if (query.offset) {
      values.push(query.offset);
      sql += ` OFFSET $${values.length}`;
    }
    const res = await this.pool.query(sql, values);
    return res.rows.map((r: Record<string, unknown>) => this.mapRow(r));
  }

  async count(query: Query<T> = {}): Promise<number> {
    const values: unknown[] = [];
    const res = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM ${this.table}${this.buildWhere(query, values)}`,
      values,
    );
    return Number((res.rows[0] as { n: number }).n);
  }

  async findOne(query: Query<T>): Promise<T | undefined> {
    return (await this.find({ ...query, limit: 1 }))[0];
  }
}
