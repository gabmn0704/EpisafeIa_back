import { describe, expect, it } from 'vitest';
import { Graph } from '../../src/structures/Graph';

describe('Graph', () => {
  const build = () => {
    const g = new Graph();
    g.addCoOccurrence(['sueno', 'estres', 'cafe']);
    g.addCoOccurrence(['sueno', 'estres']);
    g.addCoOccurrence(['alcohol', 'luces']);
    return g;
  };

  it('accumulates edge weights and frequencies', () => {
    const g = build();
    expect(g.weight('sueno', 'estres')).toBe(2);
    expect(g.weight('estres', 'sueno')).toBe(2);
    expect(g.weight('sueno', 'luces')).toBe(0);
    expect(g.frequency('sueno')).toBe(2);
    expect(g.nodeCount).toBe(5);
    expect(g.edgeCount).toBe(4);
  });

  it('ignores self loops', () => {
    const g = new Graph();
    g.addEdge('a', 'a');
    expect(g.edgeCount).toBe(0);
  });

  it('traverses with BFS and DFS', () => {
    const g = new Graph();
    g.addEdge('a', 'b');
    g.addEdge('a', 'c');
    g.addEdge('b', 'd');
    expect(g.bfs('a')).toEqual(['a', 'b', 'c', 'd']);
    expect(g.dfs('a')).toEqual(['a', 'b', 'd', 'c']);
    expect(g.bfs('zz')).toEqual([]);
  });

  it('finds connected components and shortest paths', () => {
    const g = build();
    expect(g.connectedComponents()).toHaveLength(2);
    expect(g.shortestPath('sueno', 'luces')).toBeNull();
    g.addEdge('cafe', 'alcohol');
    expect(g.shortestPath('sueno', 'luces')).toEqual(['sueno', 'cafe', 'alcohol', 'luces']);
    expect(new Graph().shortestPath('a', 'b')).toBeNull();
  });

  it('computes PageRank that sums to 1 and favours hubs', () => {
    const g = new Graph();
    ['b', 'c', 'd', 'e'].forEach((n) => g.addEdge('hub', n));
    const pr = g.pageRank();
    const sum = [...pr.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(pr.get('hub') ?? 0).toBeGreaterThan(pr.get('b') ?? 1);
  });

  it('lists top edges by weight', () => {
    const top = build().topEdges(1);
    expect(top[0]).toMatchObject({ weight: 2 });
  });
});
