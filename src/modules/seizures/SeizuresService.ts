import type { Seizure } from '../../domain/types';
import { ownedOrNotFound } from '../../http/ownership';
import type { Repos } from '../../repositories/Repos';
import { AVLTree } from '../../structures/AVLTree';
import { DoublyLinkedList } from '../../structures/DoublyLinkedList';
import { Graph } from '../../structures/Graph';
import { LRUCache } from '../../structures/LRUCache';
import type { SeizureCreate, SeizureUpdate } from './schemas';

export interface SeizureStats {
  total: number;
  lastSeizureAt: string | null;
  daysSinceLast: number | null;
  avgDurationSeconds: number | null;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byHour: number[];
  lowSleepShare: number | null;
  lowSleepSamples: number;
  triggers: {
    top: { name: string; count: number; rank: number }[];
    coOccurrences: { a: string; b: string; weight: number }[];
  };
}

/** Clave del índice AVL: ISO (longitud fija, ordena cronológicamente) + id para evitar colisiones. */
const keyOf = (s: Pick<Seizure, 'startedAt' | 'id'>): string => `${s.startedAt}#${s.id}`;

export const toIso = (s: string): string => new Date(s).toISOString();

/** Convierte un límite YYYY-MM-DD en el inicio/fin de ese día (UTC). */
export function rangeBound(value: string | undefined, end: boolean): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return end ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
  return toIso(value);
}

export class SeizuresService {
  /** Índice AVL por usuario: consultas por rango de fechas en O(log n + m). */
  private indexes = new LRUCache<string, AVLTree<string, Seizure>>(200, 5 * 60_000);

  constructor(
    private readonly repos: Repos,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async index(userId: string): Promise<AVLTree<string, Seizure>> {
    let tree = this.indexes.get(userId);
    if (!tree) {
      const all = await this.repos.seizures.find({ where: { userId } });
      tree = AVLTree.from(all.map((s) => [keyOf(s), s] as [string, Seizure]));
      this.indexes.set(userId, tree);
    }
    return tree;
  }

  invalidate(userId: string): void {
    this.indexes.delete(userId);
  }

  /** Todas las crisis del usuario en orden cronológico ascendente. */
  async all(userId: string): Promise<Seizure[]> {
    return (await this.index(userId)).inOrder().map(([, s]) => s);
  }

  /** Crisis en [from, to] (ISO) en orden cronológico ascendente. */
  async between(userId: string, from?: string, to?: string): Promise<Seizure[]> {
    const tree = await this.index(userId);
    return tree.range(from, to === undefined ? undefined : to + '~').map(([, s]) => s);
  }

  async list(userId: string, q: { from?: string; to?: string; page: number; limit: number }) {
    const matching = await this.between(userId, rangeBound(q.from, false), rangeBound(q.to, true));
    const desc = matching.reverse();
    const start = (q.page - 1) * q.limit;
    return {
      seizures: desc.slice(start, start + q.limit),
      page: q.page,
      limit: q.limit,
      total: desc.length,
      totalPages: Math.max(1, Math.ceil(desc.length / q.limit)),
    };
  }

  async create(userId: string, input: SeizureCreate): Promise<Seizure> {
    const seizure = await this.repos.seizures.insert({
      userId,
      startedAt: toIso(input.startedAt),
      durationSeconds: input.durationSeconds ?? null,
      severity: input.severity ?? null,
      seizureType: input.seizureType ?? null,
      triggersNoted: input.triggersNoted,
      location: input.location ?? null,
      notes: input.notes ?? null,
      source: input.source,
      resolvedAt: input.resolvedAt ? toIso(input.resolvedAt) : null,
    });
    this.invalidate(userId);
    return seizure;
  }

  /** Crisis + vecinos anterior/siguiente mediante lista doblemente enlazada con cursor. */
  async getWithNavigation(userId: string, id: string) {
    const seizure = ownedOrNotFound(await this.repos.seizures.get(id), userId, 'Crisis');
    const history = DoublyLinkedList.from(await this.all(userId));
    history.moveTo((s) => s.id === id);
    return {
      seizure,
      navigation: { previousId: history.peekPrevious()?.id ?? null, nextId: history.peekNext()?.id ?? null },
    };
  }

  async update(userId: string, id: string, input: SeizureUpdate): Promise<Seizure> {
    ownedOrNotFound(await this.repos.seizures.get(id), userId, 'Crisis');
    const patch = {
      ...input,
      ...(input.startedAt ? { startedAt: toIso(input.startedAt) } : {}),
      ...(input.resolvedAt ? { resolvedAt: toIso(input.resolvedAt) } : {}),
    };
    const updated = await this.repos.seizures.update(id, patch);
    this.invalidate(userId);
    return ownedOrNotFound(updated, userId, 'Crisis');
  }

  async remove(userId: string, id: string): Promise<void> {
    ownedOrNotFound(await this.repos.seizures.get(id), userId, 'Crisis');
    await this.repos.seizures.delete(id);
    this.invalidate(userId);
  }

  async stats(userId: string): Promise<SeizureStats> {
    const seizures = await this.all(userId);
    const sleepByDate = new Map(
      (await this.repos.dailyLogs.find({ where: { userId } })).filter((l) => l.sleepHours !== null).map((l) => [l.logDate, l.sleepHours as number]),
    );

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byHour = new Array<number>(24).fill(0);
    const triggerGraph = new Graph();
    let durationSum = 0;
    let durationN = 0;
    let lowSleep = 0;
    let withSleep = 0;

    for (const s of seizures) {
      if (s.severity !== null) bySeverity[String(s.severity)] = (bySeverity[String(s.severity)] ?? 0) + 1;
      if (s.seizureType) byType[s.seizureType] = (byType[s.seizureType] ?? 0) + 1;
      byHour[new Date(s.startedAt).getUTCHours()]!++;
      if (s.durationSeconds !== null) {
        durationSum += s.durationSeconds;
        durationN++;
      }
      if (s.triggersNoted.length) triggerGraph.addCoOccurrence(s.triggersNoted.map((t) => t.toLowerCase()));
      const sleep = sleepByDate.get(s.startedAt.slice(0, 10));
      if (sleep !== undefined) {
        withSleep++;
        if (sleep < 5) lowSleep++;
      }
    }

    const ranks = triggerGraph.pageRank();
    const top = triggerGraph
      .nodes()
      .map((name) => ({ name, count: triggerGraph.frequency(name), rank: Math.round((ranks.get(name) ?? 0) * 1000) / 1000 }))
      .sort((a, b) => b.count - a.count || b.rank - a.rank || a.name.localeCompare(b.name))
      .slice(0, 10);

    const last = seizures[seizures.length - 1];
    return {
      total: seizures.length,
      lastSeizureAt: last?.startedAt ?? null,
      daysSinceLast: last ? Math.floor((this.now().getTime() - Date.parse(last.startedAt)) / 86_400_000) : null,
      avgDurationSeconds: durationN ? Math.round(durationSum / durationN) : null,
      bySeverity,
      byType,
      byHour,
      lowSleepShare: withSleep ? Math.round((lowSleep / withSleep) * 100) / 100 : null,
      lowSleepSamples: withSleep,
      triggers: { top, coOccurrences: triggerGraph.topEdges(10) },
    };
  }
}
