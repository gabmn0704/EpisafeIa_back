import { describe, expect, it } from 'vitest';
import { Trie } from '../../src/structures/Trie';

describe('Trie', () => {
  const build = () => {
    const t = new Trie<number>();
    ['Levetiracetam', 'Lamotrigina', 'Lacosamida', 'Valproato', 'Carbamazepina'].forEach((w, i) => t.insert(w, i));
    return t;
  };

  it('autocompletes by prefix alphabetically', () => {
    const t = build();
    expect(t.autocomplete('la')).toEqual(['Lacosamida', 'Lamotrigina']);
    expect(t.autocomplete('L', 2)).toEqual(['Lacosamida', 'Lamotrigina']);
    expect(t.autocomplete('zzz')).toEqual([]);
  });

  it('ignores case and accents', () => {
    const t = new Trie();
    t.insert('Ácido valproico');
    expect(t.has('acido valproico')).toBe(true);
    expect(t.autocomplete('ACI')).toEqual(['Ácido valproico']);
  });

  it('stores values and checks prefixes', () => {
    const t = build();
    expect(t.get('valproato')).toBe(3);
    expect(t.startsWith('carba')).toBe(true);
    expect(t.has('carba')).toBe(false);
    expect(t.size).toBe(5);
  });

  it('deletes words without breaking others', () => {
    const t = build();
    expect(t.delete('Lamotrigina')).toBe(true);
    expect(t.delete('Lamotrigina')).toBe(false);
    expect(t.autocomplete('la')).toEqual(['Lacosamida']);
    expect(t.size).toBe(4);
  });

  it('ignores empty words and duplicate inserts', () => {
    const t = new Trie();
    t.insert('   ');
    t.insert('a');
    t.insert('a');
    expect(t.size).toBe(1);
  });
});
