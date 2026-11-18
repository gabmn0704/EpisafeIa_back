import type { Pool } from 'pg';
import type { Repos } from '../Repos';
import { PgTable } from './PgTable';

/** Repositorios PostgreSQL sobre el esquema del repo EpisafeIa_BD. */
export function createPgRepos(pool: Pick<Pool, 'query'>): Repos {
  return {
    users: new PgTable(pool, 'users'),
    contacts: new PgTable(pool, 'emergency_contacts'),
    medications: new PgTable(pool, 'medications'),
    medicationLogs: new PgTable(pool, 'medication_logs'),
    dailyLogs: new PgTable(pool, 'daily_logs'),
    seizures: new PgTable(pool, 'seizures'),
    emergencyEvents: new PgTable(pool, 'emergency_events'),
    notifications: new PgTable(pool, 'notifications', { jsonColumns: ['payload'] }),
    riskAssessments: new PgTable(pool, 'risk_assessments', { jsonColumns: ['factors'] }),
    insights: new PgTable(pool, 'insights', { jsonColumns: ['evidence'] }),
    devices: new PgTable(pool, 'wearable_devices'),
    samples: new PgTable(pool, 'wearable_samples'),
    alerts: new PgTable(pool, 'wearable_alerts', { jsonColumns: ['payload'] }),
    audit: new PgTable(pool, 'audit_log', { jsonColumns: ['meta'] }),
    refreshTokens: new PgTable(pool, 'refresh_tokens'),
  };
}
