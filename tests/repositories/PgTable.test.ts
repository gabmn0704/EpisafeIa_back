import { describe, expect, it } from 'vitest';
import { PgTable } from '../../src/repositories/pg/PgTable';

interface Row {
  id: string;
  userId: string;
  loggedAt: string;
  payload: Record<string, unknown>;
}

function fakePool(rows: Record<string, unknown>[] = [], rowCount = 1) {
  const calls: { sql: string; values: unknown[] }[] = [];
  return {
    calls,
    pool: {
      query: async (sql: string, values: unknown[] = []) => {
        calls.push({ sql, values });
        return { rows, rowCount };
      },
    } as never,
  };
}

describe('PgTable', () => {
  it('rejects invalid table names', () => {
    expect(() => new PgTable(fakePool().pool, 'users; drop table x')).toThrow();
  });

  it('builds parameterised INSERT with snake_case and json columns', async () => {
    const f = fakePool([{ id: '1', user_id: 'u', logged_at: new Date('2024-01-01T00:00:00Z'), payload: { a: 1 } }]);
    const t = new PgTable<Row>(f.pool, 'audit_log', { jsonColumns: ['payload'] });
    const row = await t.insert({ userId: 'u', loggedAt: 'now', payload: { a: 1 } });
    expect(f.calls[0]?.sql).toBe('INSERT INTO audit_log (user_id, logged_at, payload) VALUES ($1, $2, $3) RETURNING *');
    expect(f.calls[0]?.values).toEqual(['u', 'now', '{"a":1}']);
    expect(row).toEqual({ id: '1', userId: 'u', loggedAt: '2024-01-01T00:00:00.000Z', payload: { a: 1 } });
  });

  it('builds WHERE, range, ORDER and LIMIT clauses', async () => {
    const f = fakePool();
    const t = new PgTable<Row>(f.pool, 'logs');
    await t.find({
      where: { userId: 'u' },
      range: { field: 'loggedAt', from: 'a', to: 'b' },
      orderBy: 'loggedAt',
      desc: true,
      limit: 5,
      offset: 10,
    });
    expect(f.calls[0]?.sql).toBe(
      'SELECT * FROM logs WHERE user_id = $1 AND logged_at >= $2 AND logged_at <= $3 ORDER BY logged_at DESC LIMIT $4 OFFSET $5',
    );
    expect(f.calls[0]?.values).toEqual(['u', 'a', 'b', 5, 10]);
  });

  it('builds UPDATE, DELETE and COUNT', async () => {
    const f = fakePool([{ n: 4 }]);
    const t = new PgTable<Row>(f.pool, 'logs');
    await t.update('id1', { userId: 'x' });
    expect(f.calls[0]?.sql).toBe('UPDATE logs SET user_id = $1 WHERE id = $2 RETURNING *');
    expect(await t.delete('id1')).toBe(true);
    expect(await t.count({ where: { userId: 'u' } })).toBe(4);
    expect(f.calls[2]?.sql).toBe('SELECT COUNT(*)::int AS n FROM logs WHERE user_id = $1');
  });

  it('never interpolates values into SQL', async () => {
    const f = fakePool();
    const t = new PgTable<Row>(f.pool, 'logs');
    await t.find({ where: { userId: "x'; DROP TABLE logs; --" } });
    expect(f.calls[0]?.sql).not.toContain('DROP');
  });
});
