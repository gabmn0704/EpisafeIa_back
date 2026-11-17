/** Grafo no dirigido ponderado con lista de adyacencia. */
export class Graph {
  private adj = new Map<string, Map<string, number>>();
  private readonly counts = new Map<string, number>();

  get nodeCount(): number {
    return this.adj.size;
  }

  get edgeCount(): number {
    let n = 0;
    for (const m of this.adj.values()) n += m.size;
    return n / 2;
  }

  addNode(id: string): void {
    if (!this.adj.has(id)) this.adj.set(id, new Map());
  }

  hasNode(id: string): boolean {
    return this.adj.has(id);
  }

  /** Suma `weight` a la arista a-b (se crea si no existe). */
  addEdge(a: string, b: string, weight = 1): void {
    if (a === b) return;
    this.addNode(a);
    this.addNode(b);
    const w = (this.adj.get(a)?.get(b) ?? 0) + weight;
    this.adj.get(a)?.set(b, w);
    this.adj.get(b)?.set(a, w);
  }

  weight(a: string, b: string): number {
    return this.adj.get(a)?.get(b) ?? 0;
  }

  neighbors(id: string): string[] {
    return [...(this.adj.get(id)?.keys() ?? [])];
  }

  nodes(): string[] {
    return [...this.adj.keys()];
  }

  /** Cuántas veces se observó el nodo (frecuencia) para ponderar. */
  bump(id: string): void {
    this.addNode(id);
    this.counts.set(id, (this.counts.get(id) ?? 0) + 1);
  }

  frequency(id: string): number {
    return this.counts.get(id) ?? 0;
  }

  /** Registra una co-ocurrencia: conecta todos los pares del conjunto. */
  addCoOccurrence(items: string[]): void {
    const uniq = [...new Set(items)];
    for (const i of uniq) this.bump(i);
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) this.addEdge(uniq[i] as string, uniq[j] as string, 1);
    }
  }

  bfs(start: string): string[] {
    if (!this.adj.has(start)) return [];
    const seen = new Set([start]);
    const order: string[] = [];
    const queue: string[] = [start];
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head] as string;
      order.push(cur);
      for (const n of [...(this.adj.get(cur)?.keys() ?? [])].sort()) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    return order;
  }

  dfs(start: string): string[] {
    if (!this.adj.has(start)) return [];
    const seen = new Set<string>();
    const order: string[] = [];
    const visit = (id: string): void => {
      seen.add(id);
      order.push(id);
      for (const n of [...(this.adj.get(id)?.keys() ?? [])].sort()) if (!seen.has(n)) visit(n);
    };
    visit(start);
    return order;
  }

  /** Componentes conexos (cada uno ordenado alfabéticamente). */
  connectedComponents(): string[][] {
    const seen = new Set<string>();
    const out: string[][] = [];
    for (const id of this.adj.keys()) {
      if (seen.has(id)) continue;
      const comp = this.bfs(id);
      comp.forEach((c) => seen.add(c));
      out.push(comp.sort());
    }
    return out;
  }

  /** Camino más corto (nº de saltos) entre dos nodos o null. */
  shortestPath(from: string, to: string): string[] | null {
    if (!this.adj.has(from) || !this.adj.has(to)) return null;
    const prev = new Map<string, string | null>([[from, null]]);
    const queue = [from];
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head] as string;
      if (cur === to) break;
      for (const n of this.adj.get(cur)?.keys() ?? []) {
        if (!prev.has(n)) {
          prev.set(n, cur);
          queue.push(n);
        }
      }
    }
    if (!prev.has(to)) return null;
    const path: string[] = [];
    for (let c: string | null = to; c !== null; c = prev.get(c) ?? null) path.push(c);
    return path.reverse();
  }

  /** PageRank ponderado por peso de arista (iteración de potencia). */
  pageRank(damping = 0.85, iterations = 50): Map<string, number> {
    const nodes = this.nodes();
    const n = nodes.length;
    const rank = new Map<string, number>();
    if (n === 0) return rank;
    nodes.forEach((id) => rank.set(id, 1 / n));
    const strength = new Map<string, number>();
    for (const id of nodes) {
      let s = 0;
      for (const w of this.adj.get(id)?.values() ?? []) s += w;
      strength.set(id, s);
    }
    for (let it = 0; it < iterations; it++) {
      const next = new Map<string, number>();
      let dangling = 0;
      for (const id of nodes) if ((strength.get(id) ?? 0) === 0) dangling += rank.get(id) ?? 0;
      for (const id of nodes) {
        let sum = 0;
        for (const [nb, w] of this.adj.get(id) ?? []) {
          sum += ((rank.get(nb) ?? 0) * w) / (strength.get(nb) || 1);
        }
        next.set(id, (1 - damping) / n + damping * (sum + dangling / n));
      }
      nodes.forEach((id) => rank.set(id, next.get(id) ?? 0));
    }
    return rank;
  }

  /** Aristas ordenadas por peso descendente. */
  topEdges(limit = 10): { a: string; b: string; weight: number }[] {
    const edges: { a: string; b: string; weight: number }[] = [];
    for (const [a, m] of this.adj) {
      for (const [b, weight] of m) if (a < b) edges.push({ a, b, weight });
    }
    return edges.sort((x, y) => y.weight - x.weight || x.a.localeCompare(y.a)).slice(0, limit);
  }
}
