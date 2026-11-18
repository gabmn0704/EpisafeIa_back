import { describe, expect, it } from 'vitest';
import { CachedTable } from '../../src/patterns/CachedTable';
import { MemoryTable } from '../../src/repositories/memory/MemoryTable';

interface Row {
  id: string;
  name: string;
}

class CountingTable extends MemoryTable<Row> {
  gets = 0;
  override async get(id: string): Promise<Row | undefined> {
    this.gets++;
    return super.get(id);
  }
}

describe('CachedTable (Proxy)', () => {
  it('serves repeated reads from cache', async () => {
    const inner = new CountingTable();
    const t = new CachedTable<Row>(inner);
    const row = await inner.insert({ name: 'a' });
    await t.get(row.id);
    await t.get(row.id);
    await t.get(row.id);
    expect(inner.gets).toBe(1);
    expect(t.stats.hits).toBe(2);
  });

  it('keeps cache coherent on update and delete', async () => {
    const inner = new CountingTable();
    const t = new CachedTable<Row>(inner);
    const row = await t.insert({ name: 'a' });
    await t.update(row.id, { name: 'b' });
    expect((await t.get(row.id))?.name).toBe('b');
    await t.delete(row.id);
    expect(await t.get(row.id)).toBeUndefined();
  });

  it('delegates queries and does not leak mutable cache entries', async () => {
    const t = new CachedTable<Row>(new MemoryTable<Row>());
    const row = await t.insert({ name: 'a' });
    const copy = (await t.get(row.id)) as Row;
    copy.name = 'hacked';
    expect((await t.get(row.id))?.name).toBe('a');
    expect(await t.count()).toBe(1);
    expect(await t.find({ where: { name: 'a' } })).toHaveLength(1);
    expect((await t.findOne({ where: { name: 'a' } }))?.id).toBe(row.id);
  });
});
