import type {
  AuditEntry,
  DailyLog,
  EmergencyContact,
  EmergencyEvent,
  Insight,
  Medication,
  MedicationLog,
  NotificationRecord,
  RefreshTokenRecord,
  RiskAssessment,
  Seizure,
  User,
  WearableAlert,
  WearableDevice,
  WearableSample,
} from '../domain/types';
import type { Table } from './Table';

/** Conjunto de repositorios que consume la capa de servicios. */
export interface Repos {
  users: Table<User>;
  contacts: Table<EmergencyContact>;
  medications: Table<Medication>;
  medicationLogs: Table<MedicationLog>;
  dailyLogs: Table<DailyLog>;
  seizures: Table<Seizure>;
  emergencyEvents: Table<EmergencyEvent>;
  notifications: Table<NotificationRecord>;
  riskAssessments: Table<RiskAssessment>;
  insights: Table<Insight>;
  devices: Table<WearableDevice>;
  samples: Table<WearableSample>;
  alerts: Table<WearableAlert>;
  audit: Table<AuditEntry>;
  refreshTokens: Table<RefreshTokenRecord>;
}
