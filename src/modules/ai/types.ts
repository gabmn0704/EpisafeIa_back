import type { DailyLog, MedicationLog, RiskFactor, RiskLevel, Seizure } from '../../domain/types';

export interface AiInsight {
  kind: string;
  title: string;
  body: string;
  evidence: Record<string, unknown>;
  confidence: number;
}

export interface PatternsRequest {
  seizures: Seizure[];
  dailyLogs: DailyLog[];
  medicationLogs: MedicationLog[];
}

export interface RiskToday {
  sleepHours: number | null;
  stressLevel: number | null;
  caffeineMg: number | null;
  exerciseMinutes: number | null;
  missedMeds: number;
  hrAvg?: number | null;
  hrvMs?: number | null;
  motion?: number | null;
}

export interface RiskHistory {
  seizureCount90d: number;
  daysSinceLastSeizure: number | null;
  avgSleepHours30d: number | null;
  avgStress30d: number | null;
}

export interface RiskRequest {
  today: RiskToday;
  history: RiskHistory;
}

export interface RiskResponse {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  modelVersion: string;
  confidence: number;
}
