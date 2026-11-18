import { NotFoundError } from '../../errors';
import { addDays, dateInZone, daysBetween } from '../../http/dates';
import type { Repos } from '../../repositories/Repos';
import {
  MedicalReportBuilder,
  type MedicalReport,
  type ReportLifestyle,
  type ReportRisk,
  type ReportSeizureSummary,
} from '../../patterns/MedicalReportBuilder';
import { FenwickTree } from '../../structures/FenwickTree';
import { Graph } from '../../structures/Graph';
import { SegmentTree } from '../../structures/SegmentTree';
import type { MedicationsService } from '../medications/MedicationsService';
import type { SeizuresService } from '../seizures/SeizuresService';

const r1 = (n: number): number => Math.round(n * 10) / 10;

export class ReportsService {
  constructor(
    private readonly repos: Repos,
    private readonly seizures: SeizuresService,
    private readonly medications: MedicationsService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Informe del periodo [from, to] (YYYY-MM-DD); por defecto los últimos 30 días. */
  async medical(userId: string, from?: string, to?: string): Promise<MedicalReport> {
    const user = await this.repos.users.get(userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');
    const end = to ?? dateInZone(this.now(), user.timezone);
    const start = from ?? addDays(end, -29);
    const span = daysBetween(start, end) + 1;

    const builder = new MedicalReportBuilder(this.now)
      .forPatient({ fullName: user.fullName, birthDate: user.birthDate, email: user.email })
      .forPeriod(start, end)
      .addSeizures(await this.seizureSummary(userId, start, end))
      .addLifestyle(await this.lifestyle(userId, start, end))
      .addRisk(await this.risk(userId, start, end));

    const adherence = await this.medications.adherence(userId, Math.min(365, Math.max(1, span)));
    const meds = await this.medications.list(userId);
    builder.addMedications(
      meds
        .filter((m) => m.active)
        .map((m) => ({
          name: m.name,
          dose: m.dose,
          unit: m.unit,
          scheduleTimes: m.scheduleTimes,
          adherenceRate: adherence.perMedication.find((p) => p.medicationId === m.id)?.rate ?? null,
        })),
    );
    if (adherence.rate !== null) builder.addNote(`Adherencia global al tratamiento: ${Math.round(adherence.rate * 100)}%.`);
    return builder.build();
  }

  private async seizureSummary(userId: string, start: string, end: string): Promise<ReportSeizureSummary> {
    const items = await this.seizures.between(userId, `${start}T00:00:00.000Z`, `${end}T23:59:59.999Z`);
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const graph = new Graph();
    let dur = 0;
    let durN = 0;
    for (const s of items) {
      if (s.severity !== null) bySeverity[String(s.severity)] = (bySeverity[String(s.severity)] ?? 0) + 1;
      if (s.seizureType) byType[s.seizureType] = (byType[s.seizureType] ?? 0) + 1;
      if (s.durationSeconds !== null) {
        dur += s.durationSeconds;
        durN++;
      }
      graph.addCoOccurrence(s.triggersNoted.map((t) => t.toLowerCase()));
    }
    return {
      total: items.length,
      avgDurationSeconds: durN ? Math.round(dur / durN) : null,
      bySeverity,
      byType,
      topTriggers: graph
        .nodes()
        .map((name) => ({ name, count: graph.frequency(name) }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 5),
      items: items.map((s) => ({
        startedAt: s.startedAt,
        durationSeconds: s.durationSeconds,
        severity: s.severity,
        seizureType: s.seizureType,
        triggers: s.triggersNoted,
      })),
    };
  }

  /**
   * Promedios con Fenwick (sumas por rango de días) y mínimo con árbol de
   * segmentos (consulta de mínimo por rango).
   */
  private async lifestyle(userId: string, start: string, end: string): Promise<ReportLifestyle> {
    const span = daysBetween(start, end) + 1;
    const logs = await this.repos.dailyLogs.find({ where: { userId }, range: { field: 'logDate', from: start, to: end } });
    const sleepSum = new FenwickTree(span);
    const sleepCount = new FenwickTree(span);
    const stressSum = new FenwickTree(span);
    const stressCount = new FenwickTree(span);
    const caffeineSum = new FenwickTree(span);
    const caffeineCount = new FenwickTree(span);
    const minSleep = new Array<number>(span).fill(Infinity);
    let short = 0;

    for (const l of logs) {
      const i = daysBetween(start, l.logDate);
      if (i < 0 || i >= span) continue;
      if (l.sleepHours !== null) {
        sleepSum.add(i, l.sleepHours);
        sleepCount.add(i, 1);
        minSleep[i] = l.sleepHours;
        if (l.sleepHours < 5) short++;
      }
      if (l.stressLevel !== null) {
        stressSum.add(i, l.stressLevel);
        stressCount.add(i, 1);
      }
      if (l.caffeineMg !== null) {
        caffeineSum.add(i, l.caffeineMg);
        caffeineCount.add(i, 1);
      }
    }
    const mean = (sum: FenwickTree, cnt: FenwickTree): number | null => {
      const c = cnt.rangeSum(0, span - 1);
      return c ? r1(sum.rangeSum(0, span - 1) / c) : null;
    };
    const min = SegmentTree.min(minSleep).query(0, span - 1);
    return {
      daysLogged: logs.length,
      avgSleepHours: mean(sleepSum, sleepCount),
      minSleepHours: Number.isFinite(min) ? min : null,
      avgStress: mean(stressSum, stressCount),
      avgCaffeineMg: mean(caffeineSum, caffeineCount) === null ? null : Math.round(mean(caffeineSum, caffeineCount) as number),
      shortSleepDays: short,
    };
  }

  private async risk(userId: string, start: string, end: string): Promise<ReportRisk> {
    const rows = await this.repos.riskAssessments.find({ where: { userId }, range: { field: 'assessedOn', from: start, to: end } });
    if (!rows.length) return { avgScore: null, maxScore: null, highRiskDays: 0 };
    return {
      avgScore: Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length),
      maxScore: Math.max(...rows.map((r) => r.score)),
      highRiskDays: rows.filter((r) => r.level === 'high' || r.level === 'critical').length,
    };
  }
}
