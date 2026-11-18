import type { Logger } from 'pino';
import type { Repos } from '../repositories/Repos';

/** Registra acciones relevantes en audit_log sin romper la operación si falla. */
export class AuditService {
  constructor(
    private readonly repos: Repos,
    private readonly log: Logger,
  ) {}

  async record(userId: string | null, action: string, entity: string, entityId: string | null, meta: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.repos.audit.insert({ userId, action, entity, entityId, meta, at: new Date().toISOString() });
    } catch (err) {
      this.log.warn({ err, action }, 'audit log failed');
    }
  }
}
