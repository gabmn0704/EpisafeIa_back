import type { Insight, RiskAssessment } from '../../domain/types';
import { addDays, dateInZone } from '../../http/dates';
import type { Repos } from '../../repositories/Repos';
import { LRUCache } from '../../structures/LRUCache';
import type { EventBus } from '../../services/EventBus';
import type { MedicationsService } from '../medications/MedicationsService';
import type { SeizuresService } from '../seizures/SeizuresService';
import type { WearablesService } from '../wearables/WearablesService';
import type { AiClient } from './AiClient';
import { localInsights, localRisk } from './fallback';
import type { AiInsight, RiskRequest, RiskResponse } from './types';

export interface InsightsResult {
  insights: Insight[];
  degraded: boolean;
}

export interface RiskResult {
  assessment: RiskAssessment;
  confidence: number;
  degraded: boolean;
  inputs: RiskRequest;
}

const HISTORY_DAYS = 180;

export class AiService {
  private riskCache = new LRUCache<string, RiskResult>(500, 2 * 60_000);

  constructor(
    private readonly repos: Repos,
    private readonly client: AiClient,
    private readonly seizures: SeizuresService,
    private readonly medications: MedicationsService,
    private readonly wearables: WearablesService,
    private readonly bus: EventBus,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async storedInsights(userId: string): Promise<Insight[]> {
    return this.repos.insights.find({ where: { userId }, orderBy: 'createdAt', desc: true });
  }

  /** Insights guardados; si todavía no hay ninguno se calculan en el momento. */
  async insights(userId: string): Promise<InsightsResult> {
    const stored = await this.storedInsights(userId);
    if (stored.length) return { insights: stored, degraded: stored.some((i) => i.evidence.source === 'fallback') };
    return this.refresh(userId);
  }

  /** Recalcula los insights con el servicio de IA (o con el fallback local si cae). */
  async refresh(userId: string): Promise<InsightsResult> {
    const since = new Date(this.now().getTime() - HISTORY_DAYS * 86_400_000);
    const sinceDate = since.toISOString().slice(0, 10);
    const [seizures, dailyLogs, medicationLogs] = await Promise.all([
      this.seizures.between(userId, since.toISOString()),
      this.repos.dailyLogs.find({ where: { userId }, range: { field: 'logDate', from: sinceDate }, orderBy: 'logDate' }),
      this.repos.medicationLogs.find({ where: { userId }, range: { field: 'scheduledFor', from: since.toISOString() } }),
    ]);
    const payload = { seizures, dailyLogs, medicationLogs };

    let generated: AiInsight[];
    let degraded = false;
    try {
      generated = await this.client.analyzePatterns(payload);
    } catch {
      degraded = true;
      generated = localInsights(payload);
    }

    for (const old of await this.storedInsights(userId)) await this.repos.insights.delete(old.id);
    const createdAt = this.now().toISOString();
    const insights: Insight[] = [];
    for (const g of generated) {
      insights.push(
        await this.repos.insights.insert({
          userId,
          kind: g.kind,
          title: g.title,
          body: g.body,
          evidence: { ...g.evidence, confidence: g.confidence, source: degraded ? 'fallback' : 'ai-service' },
          createdAt,
        }),
      );
    }
    this.riskCache.delete(userId);
    return { insights, degraded };
  }

  /** Reúne las variables de hoy y el historial reciente del usuario. */
  private async buildRiskInputs(userId: string, today: string): Promise<RiskRequest> {
    const now = this.now();
    const log = await this.repos.dailyLogs.findOne({ where: { userId, logDate: today } });
    const since30 = addDays(today, -30);
    const logs30 = await this.repos.dailyLogs.find({ where: { userId }, range: { field: 'logDate', from: since30 } });
    const mean = (xs: (number | null)[]): number | null => {
      const v = xs.filter((x): x is number => x !== null);
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
    };
    const wear = await this.wearables.summary(userId, 1);
    const seizures90 = await this.seizures.between(userId, new Date(now.getTime() - 90 * 86_400_000).toISOString());
    const all = await this.seizures.all(userId);
    const last = all[all.length - 1];
    return {
      today: {
        sleepHours: log?.sleepHours ?? null,
        stressLevel: log?.stressLevel ?? null,
        caffeineMg: log?.caffeineMg ?? null,
        exerciseMinutes: log?.exerciseMinutes ?? null,
        missedMeds: await this.medications.missedToday(userId),
        hrAvg: wear.heartRate.avg,
        hrvMs: wear.avgHrvMs,
        motion: wear.maxMotion,
      },
      history: {
        seizureCount90d: seizures90.length,
        daysSinceLastSeizure: last ? Math.floor((now.getTime() - Date.parse(last.startedAt)) / 86_400_000) : null,
        avgSleepHours30d: mean(logs30.map((l) => l.sleepHours)),
        avgStress30d: mean(logs30.map((l) => l.stressLevel)),
      },
    };
  }

  /** Descarta el riesgo en caché: cambió algún dato de entrada del día. */
  invalidateRisk(userId: string): void {
    this.riskCache.delete(userId);
  }

  async riskToday(userId: string): Promise<RiskResult> {
    const cached = this.riskCache.get(userId);
    if (cached) return cached;

    const tz = (await this.repos.users.get(userId))?.timezone ?? 'UTC';
    const today = dateInZone(this.now(), tz);
    const inputs = await this.buildRiskInputs(userId, today);

    let risk: RiskResponse;
    let degraded = false;
    try {
      risk = await this.client.scoreRisk(inputs);
    } catch {
      degraded = true;
      risk = localRisk(inputs);
    }

    const data = {
      userId,
      assessedOn: today,
      score: risk.score,
      level: risk.level,
      factors: risk.factors,
      modelVersion: risk.modelVersion,
    };
    const existing = await this.repos.riskAssessments.findOne({ where: { userId, assessedOn: today } });
    const assessment = existing
      ? ((await this.repos.riskAssessments.update(existing.id, data)) as RiskAssessment)
      : await this.repos.riskAssessments.insert(data);

    const result: RiskResult = { assessment, confidence: risk.confidence, degraded, inputs };
    this.riskCache.set(userId, result);
    this.bus.publish({ userId, name: 'risk_updated', data: { score: assessment.score, level: assessment.level, degraded } });
    return result;
  }

  async riskHistory(userId: string, days: number): Promise<RiskAssessment[]> {
    const tz = (await this.repos.users.get(userId))?.timezone ?? 'UTC';
    const from = addDays(dateInZone(this.now(), tz), -(days - 1));
    return this.repos.riskAssessments.find({ where: { userId }, range: { field: 'assessedOn', from }, orderBy: 'assessedOn' });
  }
}
