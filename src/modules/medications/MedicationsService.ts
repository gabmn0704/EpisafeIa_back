import type { Medication, MedicationLog, MedicationStatus } from '../../domain/types';
import { addDays, dateInZone, zonedTimeToUtc } from '../../http/dates';
import { ownedOrNotFound } from '../../http/ownership';
import type { Repos } from '../../repositories/Repos';
import { FenwickTree } from '../../structures/FenwickTree';
import { LRUCache } from '../../structures/LRUCache';
import { Trie } from '../../structures/Trie';
import { COMMON_ANTISEIZURE_DRUGS } from './drugs';
import type { DoseLogInput, MedicationCreate, MedicationUpdate } from './schemas';

export interface ScheduledDose {
  medicationId: string;
  name: string;
  dose: string | null;
  unit: string | null;
  scheduledFor: string;
  status: MedicationStatus;
  takenAt: string | null;
  logId: string | null;
  overdue: boolean;
}

export interface AdherenceReport {
  days: number;
  taken: number;
  missed: number;
  skipped: number;
  total: number;
  rate: number | null;
  streakDays: number;
  last7Rate: number | null;
  perMedication: { medicationId: string; name: string; taken: number; total: number; rate: number | null }[];
}

/** Una dosis pendiente se considera omitida si pasaron más de 2 h de la hora programada. */
const OVERDUE_MS = 2 * 3_600_000;

export class MedicationsService {
  /** Trie por usuario (fármacos comunes + los suyos). Se invalida al modificar medicamentos. */
  private tries = new LRUCache<string, Trie>(200, 10 * 60_000);

  constructor(
    private readonly repos: Repos,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(userId: string): Promise<Medication[]> {
    return this.repos.medications.find({ where: { userId }, orderBy: 'name' });
  }

  async create(userId: string, input: MedicationCreate): Promise<Medication> {
    const med = await this.repos.medications.insert({
      userId,
      name: input.name,
      dose: input.dose ?? null,
      unit: input.unit ?? null,
      scheduleTimes: [...new Set(input.scheduleTimes)].sort(),
      active: input.active,
      notes: input.notes ?? null,
    });
    this.tries.delete(userId);
    return med;
  }

  async update(userId: string, id: string, input: MedicationUpdate): Promise<Medication> {
    ownedOrNotFound(await this.repos.medications.get(id), userId, 'Medicamento');
    const patch = { ...input, ...(input.scheduleTimes ? { scheduleTimes: [...new Set(input.scheduleTimes)].sort() } : {}) };
    const updated = await this.repos.medications.update(id, patch);
    this.tries.delete(userId);
    return ownedOrNotFound(updated, userId, 'Medicamento');
  }

  async remove(userId: string, id: string): Promise<void> {
    ownedOrNotFound(await this.repos.medications.get(id), userId, 'Medicamento');
    await this.repos.medications.delete(id);
    this.tries.delete(userId);
  }

  /** Autocompletado por prefijo con el Trie del usuario. */
  async search(userId: string, q: string, limit: number): Promise<string[]> {
    let trie = this.tries.get(userId);
    if (!trie) {
      trie = new Trie();
      COMMON_ANTISEIZURE_DRUGS.forEach((d) => trie!.insert(d));
      (await this.list(userId)).forEach((m) => trie!.insert(m.name));
      this.tries.set(userId, trie);
    }
    return trie.autocomplete(q, limit);
  }

  /** Dosis programadas para hoy (en la zona horaria del usuario) con su estado. */
  async scheduleToday(userId: string): Promise<ScheduledDose[]> {
    const user = await this.repos.users.get(userId);
    const tz = user?.timezone ?? 'UTC';
    const now = this.now();
    const today = dateInZone(now, tz);
    const from = zonedTimeToUtc(today, '00:00', tz).toISOString();
    const to = zonedTimeToUtc(addDays(today, 1), '00:00', tz).toISOString();
    const logs = await this.repos.medicationLogs.find({ where: { userId }, range: { field: 'scheduledFor', from, to } });
    const byKey = new Map(logs.map((l) => [`${l.medicationId}|${Date.parse(l.scheduledFor)}`, l]));

    const doses: ScheduledDose[] = [];
    for (const med of await this.repos.medications.find({ where: { userId, active: true } })) {
      for (const t of med.scheduleTimes) {
        const when = zonedTimeToUtc(today, t, tz);
        const log = byKey.get(`${med.id}|${when.getTime()}`);
        const status: MedicationStatus = log?.status ?? 'pending';
        doses.push({
          medicationId: med.id,
          name: med.name,
          dose: med.dose,
          unit: med.unit,
          scheduledFor: when.toISOString(),
          status,
          takenAt: log?.takenAt ?? null,
          logId: log?.id ?? null,
          overdue: status === 'pending' && now.getTime() - when.getTime() > OVERDUE_MS,
        });
      }
    }
    return doses.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor) || a.name.localeCompare(b.name));
  }

  /** Registra (o actualiza) la toma de una dosis concreta. */
  async logDose(userId: string, input: DoseLogInput): Promise<MedicationLog> {
    ownedOrNotFound(await this.repos.medications.get(input.medicationId), userId, 'Medicamento');
    const scheduledFor = new Date(input.scheduledFor).toISOString();
    const existing = await this.repos.medicationLogs.findOne({ where: { userId, medicationId: input.medicationId, scheduledFor } });
    const takenAt = input.status === 'taken' ? this.now().toISOString() : null;
    if (existing) {
      return (await this.repos.medicationLogs.update(existing.id, { status: input.status, takenAt })) as MedicationLog;
    }
    return this.repos.medicationLogs.insert({
      userId,
      medicationId: input.medicationId,
      scheduledFor,
      takenAt,
      status: input.status,
    });
  }

  /** Cuenta efectiva de un log: los pendientes viejos cuentan como omitidos. */
  private effectiveStatus(log: MedicationLog, now: number): MedicationStatus | null {
    if (log.status !== 'pending') return log.status;
    return now - Date.parse(log.scheduledFor) > OVERDUE_MS ? 'missed' : null;
  }

  async adherence(userId: string, days: number): Promise<AdherenceReport> {
    const now = this.now();
    const today = dateInZone(now, (await this.repos.users.get(userId))?.timezone ?? 'UTC');
    const startDay = addDays(today, -(days - 1));
    const from = new Date(Date.parse(startDay + 'T00:00:00Z') - 86_400_000).toISOString();
    const logs = await this.repos.medicationLogs.find({ where: { userId }, range: { field: 'scheduledFor', from } });
    const meds = new Map((await this.repos.medications.find({ where: { userId } })).map((m) => [m.id, m]));

    // takenByDay / totalByDay indexados por posición de día; Fenwick para sumas por ventana.
    const takenTree = new FenwickTree(days);
    const totalTree = new FenwickTree(days);
    const per = new Map<string, { taken: number; total: number }>();
    let taken = 0;
    let missed = 0;
    let skipped = 0;

    for (const log of logs) {
      const st = this.effectiveStatus(log, now.getTime());
      if (!st) continue;
      const day = log.scheduledFor.slice(0, 10);
      const idx = Math.round((Date.parse(day + 'T00:00:00Z') - Date.parse(startDay + 'T00:00:00Z')) / 86_400_000);
      if (idx < 0 || idx >= days) continue;
      totalTree.add(idx, 1);
      const p = per.get(log.medicationId) ?? { taken: 0, total: 0 };
      p.total++;
      if (st === 'taken') {
        takenTree.add(idx, 1);
        taken++;
        p.taken++;
      } else if (st === 'missed') missed++;
      else if (st === 'skipped') skipped++;
      per.set(log.medicationId, p);
    }

    const total = taken + missed + skipped;
    // Racha: días consecutivos (hasta hoy) con al menos un registro y todos tomados.
    let streak = 0;
    for (let i = days - 1; i >= 0; i--) {
      const t = totalTree.get(i);
      if (t === 0) {
        if (i === days - 1) continue; // hoy todavía sin registros no corta la racha
        break;
      }
      if (takenTree.get(i) < t) break;
      streak++;
    }
    const w = Math.min(7, days);
    const last7Total = totalTree.rangeSum(days - w, days - 1);
    return {
      days,
      taken,
      missed,
      skipped,
      total,
      rate: total ? round2(taken / total) : null,
      streakDays: streak,
      last7Rate: last7Total ? round2(takenTree.rangeSum(days - w, days - 1) / last7Total) : null,
      perMedication: [...per.entries()].map(([medicationId, v]) => ({
        medicationId,
        name: meds.get(medicationId)?.name ?? 'Desconocido',
        taken: v.taken,
        total: v.total,
        rate: v.total ? round2(v.taken / v.total) : null,
      })),
    };
  }

  /** Dosis omitidas hoy (para el cálculo de riesgo). */
  async missedToday(userId: string): Promise<number> {
    return (await this.scheduleToday(userId)).filter((d) => d.status === 'missed' || d.status === 'skipped' || d.overdue).length;
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
