/** Entidades del dominio. Fechas/horas como ISO-8601; `date` como YYYY-MM-DD. */
export type Role = 'patient' | 'caregiver' | 'admin';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  birthDate: string | null;
  timezone: string;
  role: Role;
  createdAt: string;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  priority: number;
  notifySms: boolean;
  notifyEmail: boolean;
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dose: string | null;
  unit: string | null;
  scheduleTimes: string[];
  active: boolean;
  notes: string | null;
}

export type MedicationStatus = 'taken' | 'missed' | 'skipped' | 'pending';

export interface MedicationLog {
  id: string;
  userId: string;
  medicationId: string;
  scheduledFor: string;
  takenAt: string | null;
  status: MedicationStatus;
}

export interface DailyLog {
  id: string;
  userId: string;
  logDate: string;
  sleepHours: number | null;
  stressLevel: number | null;
  caffeineMg: number | null;
  exerciseMinutes: number | null;
  mood: number | null;
  alcoholUnits: number | null;
  notes: string | null;
}

export type SeizureSource = 'manual' | 'emergency' | 'wearable';

export interface Seizure {
  id: string;
  userId: string;
  startedAt: string;
  durationSeconds: number | null;
  severity: number | null;
  seizureType: string | null;
  triggersNoted: string[];
  location: string | null;
  notes: string | null;
  source: SeizureSource;
  resolvedAt: string | null;
}

export type EmergencyStatus = 'active' | 'notified' | 'resolved' | 'false_alarm';

export interface EmergencyEvent {
  id: string;
  userId: string;
  seizureId: string | null;
  triggeredAt: string;
  status: EmergencyStatus;
  latitude: number | null;
  longitude: number | null;
}

export type NotificationChannelName = 'email' | 'sms' | 'push' | 'log';

export interface NotificationRecord {
  id: string;
  userId: string;
  contactId: string | null;
  eventId: string | null;
  channel: NotificationChannelName;
  payload: Record<string, unknown>;
  status: 'queued' | 'sent' | 'failed';
  createdAt: string;
  sentAt: string | null;
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface RiskFactor {
  name: string;
  impact: number;
  direction: 'up' | 'down';
  detail: string;
}

export interface RiskAssessment {
  id: string;
  userId: string;
  assessedOn: string;
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  modelVersion: string;
}

export interface Insight {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  evidence: Record<string, unknown>;
  createdAt: string;
}

export type WearableProvider = 'web_bluetooth' | 'fitbit' | 'google_health' | 'apple_health' | 'garmin' | 'manual';

export interface WearableDevice {
  id: string;
  userId: string;
  provider: WearableProvider;
  deviceName: string | null;
  externalId: string | null;
  lastSeenAt: string | null;
  active: boolean;
}

export interface WearableSample {
  id: string;
  userId: string;
  deviceId: string | null;
  sampledAt: string;
  heartRate: number | null;
  hrvMs: number | null;
  spo2: number | null;
  motionIntensity: number | null;
  skinTempC: number | null;
  steps: number | null;
}

export type WearableAlertKind = 'tachycardia' | 'motion_convulsive' | 'hr_anomaly' | 'fall';

export interface WearableAlert {
  id: string;
  userId: string;
  deviceId: string | null;
  detectedAt: string;
  kind: WearableAlertKind;
  confidence: number;
  payload: Record<string, unknown>;
  convertedEventId: string | null;
}

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown>;
  at: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revoked: boolean;
}

export interface AuthUser {
  id: string;
  role: Role;
}
