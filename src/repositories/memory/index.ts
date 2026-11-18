import type { Repos } from '../Repos';
import { MemoryTable } from './MemoryTable';

/** Repositorios en memoria: se usan en pruebas y cuando no hay DATABASE_URL. */
export function createMemoryRepos(): Repos {
  return {
    users: new MemoryTable(),
    contacts: new MemoryTable(),
    medications: new MemoryTable(),
    medicationLogs: new MemoryTable(),
    dailyLogs: new MemoryTable(),
    seizures: new MemoryTable(),
    emergencyEvents: new MemoryTable(),
    notifications: new MemoryTable(),
    riskAssessments: new MemoryTable(),
    insights: new MemoryTable(),
    devices: new MemoryTable(),
    samples: new MemoryTable(),
    alerts: new MemoryTable(),
    audit: new MemoryTable(),
    refreshTokens: new MemoryTable(),
  };
}
