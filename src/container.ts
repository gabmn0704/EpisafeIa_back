import type { Logger } from 'pino';
import type { AppConfig } from './config/env';
import type { Repos } from './repositories/Repos';
import { AuthService } from './modules/auth/AuthService';
import { ContactsService } from './modules/contacts/ContactsService';
import { MedicationsService } from './modules/medications/MedicationsService';
import { DailyLogsService } from './modules/dailyLogs/DailyLogsService';
import { SeizuresService } from './modules/seizures/SeizuresService';
import { AuditService } from './services/AuditService';
import { EventBus } from './services/EventBus';

export interface AppContext {
  config: AppConfig;
  log: Logger;
  repos: Repos;
  bus: EventBus;
  audit: AuditService;
  auth: AuthService;
  contacts: ContactsService;
  medications: MedicationsService;
  dailyLogs: DailyLogsService;
  seizures: SeizuresService;
  /** Comprobación de salud de dependencias (p. ej. ping a la BD). */
  healthCheck: () => Promise<boolean>;
}

export interface ContextOptions {
  config: AppConfig;
  log: Logger;
  repos: Repos;
  healthCheck?: () => Promise<boolean>;
}

/** Composición de dependencias (inyección manual, sin framework). */
export function buildContext(opts: ContextOptions): AppContext {
  const bus = new EventBus();
  const audit = new AuditService(opts.repos, opts.log);
  const auth = new AuthService(opts.repos, opts.config, audit);
  const medications = new MedicationsService(opts.repos);
  const dailyLogs = new DailyLogsService(opts.repos);
  const seizures = new SeizuresService(opts.repos);
  return {
    config: opts.config,
    log: opts.log,
    repos: opts.repos,
    bus,
    audit,
    auth,
    contacts: new ContactsService(opts.repos),
    medications,
    dailyLogs,
    seizures,
    healthCheck: opts.healthCheck ?? (async () => true),
  };
}
