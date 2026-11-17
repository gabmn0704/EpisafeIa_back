import type { Logger } from 'pino';
import type { AppConfig } from './config/env';
import type { Repos } from './repositories/Repos';
import { AuthService } from './modules/auth/AuthService';
import { ContactsService } from './modules/contacts/ContactsService';
import { MedicationsService } from './modules/medications/MedicationsService';
import { DailyLogsService } from './modules/dailyLogs/DailyLogsService';
import { SeizuresService } from './modules/seizures/SeizuresService';
import { NotificationChannelFactory } from './patterns/NotificationChannelFactory';
import { EmergencyService } from './modules/emergency/EmergencyService';
import { WearablesService } from './modules/wearables/WearablesService';
import { AiClient } from './modules/ai/AiClient';
import { AiService } from './modules/ai/AiService';
import { ReportsService } from './modules/reports/ReportsService';
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
  emergency: EmergencyService;
  wearables: WearablesService;
  ai: AiService;
  reports: ReportsService;
  /** Comprobación de salud de dependencias (p. ej. ping a la BD). */
  healthCheck: () => Promise<boolean>;
}

export interface ContextOptions {
  config: AppConfig;
  log: Logger;
  repos: Repos;
  healthCheck?: () => Promise<boolean>;
  /** Inyectable para pruebas del cliente de IA. */
  fetchFn?: typeof fetch;
}

/** Composición de dependencias (inyección manual, sin framework). */
export function buildContext(opts: ContextOptions): AppContext {
  const bus = new EventBus();
  const audit = new AuditService(opts.repos, opts.log);
  const auth = new AuthService(opts.repos, opts.config, audit);
  const medications = new MedicationsService(opts.repos);
  const dailyLogs = new DailyLogsService(opts.repos);
  const seizures = new SeizuresService(opts.repos);
  const channels = new NotificationChannelFactory(opts.log);
  const emergency = new EmergencyService(opts.repos, bus, channels, audit, seizures, opts.log);
  const wearables = new WearablesService(opts.repos, bus, emergency);
  const aiClient = new AiClient({
    baseUrl: opts.config.aiServiceUrl,
    timeoutMs: opts.config.aiTimeoutMs,
    log: opts.log,
    fetchFn: opts.fetchFn,
  });
  const ai = new AiService(opts.repos, aiClient, seizures, medications, wearables, bus);
  const reports = new ReportsService(opts.repos, seizures, medications);
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
    emergency,
    wearables,
    ai,
    reports,
    healthCheck: opts.healthCheck ?? (async () => true),
  };
}
