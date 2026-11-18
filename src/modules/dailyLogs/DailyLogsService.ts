import type { DailyLog } from '../../domain/types';
import { NotFoundError } from '../../errors';
import type { Repos } from '../../repositories/Repos';
import { DailyLogTemplate } from '../../patterns/Prototype';
import { BinarySearchTree } from '../../structures/BinarySearchTree';
import { HashTable } from '../../structures/HashTable';
import { LRUCache } from '../../structures/LRUCache';
import { Stack } from '../../structures/Stack';
import type { DailyLogInput } from './schemas';

interface UndoEntry {
  date: string;
  previous: DailyLog | null;
}

const UNDO_LIMIT = 20;

export class DailyLogsService {
  /** Índice por fecha (BST) por usuario para consultas de rango. */
  private indexes = new LRUCache<string, BinarySearchTree<string, DailyLog>>(200, 5 * 60_000);
  /** Pila de deshacer por usuario (HashTable + Stack). */
  private undo = new HashTable<Stack<UndoEntry>>();

  /** Se invoca tras cualquier cambio de datos (p. ej. para invalidar el riesgo calculado). */
  onChange: (userId: string) => void = () => undefined;

  constructor(private readonly repos: Repos) {}

  private async index(userId: string): Promise<BinarySearchTree<string, DailyLog>> {
    let tree = this.indexes.get(userId);
    if (!tree) {
      tree = new BinarySearchTree<string, DailyLog>();
      // Se inserta desde el centro para no degenerar el árbol sin balanceo.
      const logs = await this.repos.dailyLogs.find({ where: { userId }, orderBy: 'logDate' });
      const insertMid = (lo: number, hi: number): void => {
        if (lo > hi) return;
        const mid = (lo + hi) >> 1;
        const l = logs[mid] as DailyLog;
        tree!.insert(l.logDate, l);
        insertMid(lo, mid - 1);
        insertMid(mid + 1, hi);
      };
      insertMid(0, logs.length - 1);
      this.indexes.set(userId, tree);
    }
    return tree;
  }

  async range(userId: string, from?: string, to?: string): Promise<DailyLog[]> {
    return (await this.index(userId)).range(from, to).map(([, v]) => v);
  }

  async get(userId: string, date: string): Promise<DailyLog> {
    const found = (await this.index(userId)).get(date);
    if (!found) throw new NotFoundError('No hay registro para esa fecha');
    return found;
  }

  /** Crea o actualiza el registro de la fecha y guarda el estado previo para deshacer. */
  async upsert(userId: string, date: string, input: DailyLogInput): Promise<{ log: DailyLog; created: boolean }> {
    const existing = await this.repos.dailyLogs.findOne({ where: { userId, logDate: date } });
    const stack = this.undo.getOrSet(userId, () => new Stack<UndoEntry>(UNDO_LIMIT));
    stack.push({ date, previous: existing ?? null });
    this.indexes.delete(userId);
    if (existing) {
      const log = (await this.repos.dailyLogs.update(existing.id, input)) as DailyLog;
      this.onChange(userId);
      return { log, created: false };
    }
    const log = await this.repos.dailyLogs.insert({
      userId,
      logDate: date,
      sleepHours: input.sleepHours ?? null,
      stressLevel: input.stressLevel ?? null,
      caffeineMg: input.caffeineMg ?? null,
      exerciseMinutes: input.exerciseMinutes ?? null,
      mood: input.mood ?? null,
      alcoholUnits: input.alcoholUnits ?? null,
      notes: input.notes ?? null,
    });
    this.onChange(userId);
    return { log, created: true };
  }

  /** Deshace el último cambio (LIFO). Devuelve el registro restaurado o null si se eliminó. */
  async undoLast(userId: string): Promise<{ date: string; restored: DailyLog | null }> {
    const entry = this.undo.get(userId)?.pop();
    if (!entry) throw new NotFoundError('No hay acciones para deshacer');
    this.indexes.delete(userId);
    const current = await this.repos.dailyLogs.findOne({ where: { userId, logDate: entry.date } });
    if (!entry.previous) {
      if (current) await this.repos.dailyLogs.delete(current.id);
      this.onChange(userId);
      return { date: entry.date, restored: null };
    }
    const { id: _id, userId: _u, logDate: _d, ...fields } = entry.previous;
    const restored = current
      ? await this.repos.dailyLogs.update(current.id, fields)
      : await this.repos.dailyLogs.insert({ ...entry.previous });
    this.onChange(userId);
    return { date: entry.date, restored: restored ?? null };
  }

  pendingUndo(userId: string): number {
    return this.undo.get(userId)?.size ?? 0;
  }

  /** Plantilla (Prototype) para un registro nuevo: copia el último registro o usa valores por defecto. */
  async template(userId: string): Promise<DailyLogTemplate> {
    const [latest] = await this.repos.dailyLogs.find({ where: { userId }, orderBy: 'logDate', desc: true, limit: 1 });
    if (!latest) return DailyLogTemplate.defaults();
    return DailyLogTemplate.fromLog({
      sleepHours: latest.sleepHours,
      stressLevel: latest.stressLevel,
      caffeineMg: latest.caffeineMg,
      exerciseMinutes: latest.exerciseMinutes,
      mood: latest.mood,
      alcoholUnits: latest.alcoholUnits,
    });
  }
}
