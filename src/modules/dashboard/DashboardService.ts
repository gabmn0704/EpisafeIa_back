import type { EmergencyService } from '../emergency/EmergencyService';
import type { AiService } from '../ai/AiService';
import type { MedicationsService } from '../medications/MedicationsService';
import type { SeizuresService } from '../seizures/SeizuresService';
import type { WearablesService } from '../wearables/WearablesService';

/** Agrega en un solo payload lo que necesita la pantalla principal. */
export class DashboardService {
  constructor(
    private readonly ai: AiService,
    private readonly medications: MedicationsService,
    private readonly seizures: SeizuresService,
    private readonly wearables: WearablesService,
    private readonly emergency: EmergencyService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async summary(userId: string) {
    const [risk, adherence, all, heartRate, alerts, emergencies] = await Promise.all([
      this.ai.riskToday(userId),
      this.medications.adherence(userId, 30),
      this.seizures.all(userId),
      this.wearables.currentHeartRate(userId),
      this.wearables.activeAlerts(userId),
      this.emergency.active(userId),
    ]);
    const last = all[all.length - 1];
    const daysSinceLast = last ? Math.floor((this.now().getTime() - Date.parse(last.startedAt)) / 86_400_000) : null;
    return {
      risk: {
        score: risk.assessment.score,
        level: risk.assessment.level,
        factors: risk.assessment.factors,
        confidence: risk.confidence,
        degraded: risk.degraded,
      },
      adherence: { rate: adherence.rate, last7Rate: adherence.last7Rate, streakDays: adherence.streakDays },
      lastSeizure: last
        ? { id: last.id, startedAt: last.startedAt, severity: last.severity, durationSeconds: last.durationSeconds }
        : null,
      // Sin crisis registradas: la racha es null (no se puede afirmar nada).
      seizureFreeStreakDays: daysSinceLast,
      currentHeartRate: heartRate,
      activeAlerts: { count: alerts.length, items: alerts.slice(0, 5) },
      activeEmergencies: emergencies.length,
    };
  }
}
