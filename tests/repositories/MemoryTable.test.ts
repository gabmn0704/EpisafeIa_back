import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryTable } from '../../src/repositories/memory/MemoryTable';

interface Row {
  id: string;
  userId: string;
  at: string;
  n: number | null;
  tags: string[];
}

describe('MemoryTable', () => {
  let t: MemoryTable<Row>;
  beforeEach(async () => {
    t = new MemoryTable<Row>();
    await t.insert({ userId: 'u1', at: '2024-01-01', n: 3, tags: ['a'] });
    await t.insert({ userId: 'u1', at: '2024-02-01', n: 1, tags: [] });
    await t.insert({ userId: 'u2', at: '2024-03-01', n: null, tags: [] });
  });

  it('generates ids and returns clones', async () => {
    const r = await t.insert({ userId: 'u3', at: 'x', n: 0, tags: [] });
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    r.userId = 'mutated';
    expect((await t.get(r.id))?.userId).toBe('u3');
  });

  it('filters by equality and range', async () => {
    expect(await t.find({ where: { userId: 'u1' } })).toHaveLength(2);
    expect(await t.find({ range: { field: 'at', from: '2024-02-01', to: '2024-03-01' } })).toHaveLength(2);
    expect(await t.count({ where: { userId: 'u9' } })).toBe(0);
  });

  it('sorts and paginates', async () => {
    const asc = await t.find({ orderBy: 'at' });
    expect(asc.map((r) => r.at)).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
    const page = await t.find({ orderBy: 'at', desc: true, limit: 1, offset: 1 });
    expect(page[0]?.at).toBe('2024-02-01');
  });

  it('updates, ignoring undefined fields, and deletes', async () => {
    const [first] = await t.find({ orderBy: 'at' });
    const up = await t.update(first!.id, { n: 99, tags: undefined });
    expect(up).toMatchObject({ n: 99, tags: ['a'] });
    expect(await t.update('missing', { n: 1 })).toBeUndefined();
    expect(await t.delete(first!.id)).toBe(true);
    expect(await t.delete(first!.id)).toBe(false);
  });

  it('findOne and array equality', async () => {
    expect((await t.findOne({ where: { userId: 'u2' } }))?.at).toBe('2024-03-01');
    expect(await t.find({ where: { tags: ['a'] } })).toHaveLength(1);
  });
});
