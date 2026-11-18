class TrieNode<V> {
  children = new Map<string, TrieNode<V>>();
  terminal = false;
  value: V | undefined;
  /** Texto original (con tildes/mayúsculas) para mostrar. */
  word = '';
}

/** Normaliza para comparar: minúsculas y sin diacríticos. */
export function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Trie para autocompletado por prefijo, insensible a mayúsculas y tildes. */
export class Trie<V = true> {
  private root = new TrieNode<V>();
  private count = 0;

  get size(): number {
    return this.count;
  }

  insert(word: string, value?: V): void {
    const key = normalizeKey(word);
    if (!key) return;
    let node = this.root;
    for (const ch of key) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode<V>();
        node.children.set(ch, next);
      }
      node = next;
    }
    if (!node.terminal) this.count++;
    node.terminal = true;
    node.word = word;
    node.value = value;
  }

  has(word: string): boolean {
    return !!this.find(normalizeKey(word))?.terminal;
  }

  get(word: string): V | undefined {
    return this.find(normalizeKey(word))?.value;
  }

  startsWith(prefix: string): boolean {
    return !!this.find(normalizeKey(prefix));
  }

  delete(word: string): boolean {
    const key = normalizeKey(word);
    const path: [TrieNode<V>, string][] = [];
    let node = this.root;
    for (const ch of key) {
      const next = node.children.get(ch);
      if (!next) return false;
      path.push([node, ch]);
      node = next;
    }
    if (!node.terminal) return false;
    node.terminal = false;
    node.value = undefined;
    node.word = '';
    this.count--;
    for (let i = path.length - 1; i >= 0; i--) {
      const [parent, ch] = path[i] as [TrieNode<V>, string];
      const child = parent.children.get(ch) as TrieNode<V>;
      if (child.terminal || child.children.size > 0) break;
      parent.children.delete(ch);
    }
    return true;
  }

  /** Hasta `limit` palabras que empiezan por `prefix`, ordenadas alfabéticamente. */
  autocomplete(prefix: string, limit = 10): string[] {
    const start = this.find(normalizeKey(prefix));
    if (!start) return [];
    const out: string[] = [];
    const walk = (n: TrieNode<V>): void => {
      if (out.length >= limit) return;
      if (n.terminal) out.push(n.word);
      const keys = [...n.children.keys()].sort();
      for (const k of keys) walk(n.children.get(k) as TrieNode<V>);
    };
    walk(start);
    return out;
  }

  private find(key: string): TrieNode<V> | null {
    let node = this.root;
    for (const ch of key) {
      const next = node.children.get(ch);
      if (!next) return null;
      node = next;
    }
    return node;
  }
}
