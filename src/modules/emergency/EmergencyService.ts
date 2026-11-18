import type { Logger } from 'pino';
import type {
  EmergencyContact,
  EmergencyEvent,
  NotificationChannelName,
  NotificationRecord,
  Seizure,
} from '../../domain/types';
import { ConflictError } from '../../errors';
import { ownedOrNotFound } from '../../http/ownership';
import type { NotificationChannelFactory } from '../../patterns/NotificationChannelFactory';
import type { Repos } from '../../repositories/Repos';
import { PriorityQueue } from '../../structures/PriorityQueue';
import { Queue } from '../../structures/Queue';
import type { AuditService } from '../../services/AuditService';
import type { EventBus } from '../../services/EventBus';
import type { SeizuresService } from '../seizures/SeizuresService';
import type { EmergencyInput } from './schemas';

export interface EmergencyOutcome {
  event: EmergencyEvent;
  seizure: Seizure;
  notifications: NotificationRecord[];
  warning?: string;
}

interface DispatchJob {
  record: NotificationRecord;
  to: string;
  subject: string;
  body: string;
}

export interface TriggerOptions extends EmergencyInput {
  source?: 'emergency' | 'wearable';
}

export class EmergencyService {
  constructor(
    private readonly repos: Repos,
    private readonly bus: EventBus,
    private readonly channels: NotificationChannelFactory,
    private readonly audit: AuditService,
    private readonly seizures: SeizuresService,
    private readonly log: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Registra la emergencia y notifica a los contactos por prioridad. */
  async trigger(userId: string, input: TriggerOptions = {}): Promise<EmergencyOutcome> {
    const nowIso = this.now().toISOString();
    const user = await this.repos.users.get(userId);
    const seizure = await this.repos.seizures.insert({
      userId,
      startedAt: nowIso,
      durationSeconds: null,
      severity: null,
      seizureType: null,
      triggersNoted: [],
      location: input.latitude !== null && input.latitude !== undefined && input.longitude !== null && input.longitude !== undefined ? `${input.latitude},${input.longitude}` : null,
      notes: input.note ?? null,
      source: input.source ?? 'emergency',
      resolvedAt: null,
    });
    this.seizures.invalidate(userId);

    let event = await this.repos.emergencyEvents.insert({
      userId,
      seizureId: seizure.id,
      triggeredAt: nowIso,
      status: 'active',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    });

    // 1) Cola de prioridad: el contacto con menor número de prioridad se notifica primero.
    const contacts = await this.repos.contacts.find({ where: { userId } });
    const byPriority = new PriorityQueue<EmergencyContact>();
    contacts.forEach((c) => byPriority.enqueue(c, c.priority));

    // 2) Cola FIFO de envíos conservando ese orden.
    const jobs = new Queue<DispatchJob>();
    const patient = user?.fullName ?? 'Un usuario de EpisafeIA';
    const where =
      event.latitude !== null && event.longitude !== null
        ? ` Ubicación: https://maps.google.com/?q=${event.latitude},${event.longitude}`
        : '';
    const subject = `Alerta de emergencia: ${patient}`;
    const body = `${patient} activó una alerta de posible crisis epiléptica el ${nowIso}.${where}${input.note ? ` Nota: ${input.note}` : ''}`;

    while (!byPriority.isEmpty()) {
      const contact = byPriority.dequeue() as EmergencyContact;
      const targets: [NotificationChannelName, string][] = [];
      if (contact.notifySms && contact.phone) targets.push(['sms', contact.phone]);
      if (contact.notifyEmail && contact.email) targets.push(['email', contact.email]);
      for (const [channel, to] of targets) {
        const record = await this.repos.notifications.insert({
          userId,
          contactId: contact.id,
          eventId: event.id,
          channel,
          payload: { to, subject, body, contactName: contact.name, priority: contact.priority },
          status: 'queued',
          createdAt: nowIso,
          sentAt: null,
        });
        jobs.enqueue({ record, to, subject, body });
      }
    }

    const notifications = await this.dispatch(jobs);
    const delivered = notifications.filter((n) => n.status === 'sent').length;
    event = (await this.repos.emergencyEvents.update(event.id, { status: delivered > 0 ? 'notified' : 'active' })) ?? event;

    await this.audit.record(userId, 'emergency.trigger', 'emergency_event', event.id, { delivered, contacts: contacts.length });
    this.bus.publish({ userId, name: 'emergency', data: { event, seizureId: seizure.id, delivered } });
    this.log.warn({ userId, eventId: event.id, delivered }, 'emergency triggered');

    return {
      event,
      seizure,
      notifications,
      ...(contacts.length === 0 ? { warning: 'No tienes contactos de emergencia configurados' } : {}),
    };
  }

  /** Drena la cola FIFO enviando por el canal correspondiente. */
  private async dispatch(jobs: Queue<DispatchJob>): Promise<NotificationRecord[]> {
    const out: NotificationRecord[] = [];
    while (!jobs.isEmpty()) {
      const job = jobs.dequeue() as DispatchJob;
      let status: 'sent' | 'failed' = 'failed';
      try {
        const result = await this.channels.create(job.record.channel).send({ to: job.to, subject: job.subject, body: job.body });
        status = result.ok ? 'sent' : 'failed';
      } catch (err) {
        this.log.error({ err, channel: job.record.channel }, 'notification send failed');
      }
      const updated = await this.repos.notifications.update(job.record.id, {
        status,
        sentAt: status === 'sent' ? this.now().toISOString() : null,
      });
      out.push(updated ?? job.record);
    }
    return out;
  }

  async active(userId: string): Promise<EmergencyEvent[]> {
    const [a, b] = await Promise.all([
      this.repos.emergencyEvents.find({ where: { userId, status: 'active' } }),
      this.repos.emergencyEvents.find({ where: { userId, status: 'notified' } }),
    ]);
    return [...a, ...b].sort((x, y) => y.triggeredAt.localeCompare(x.triggeredAt));
  }

  private async openEvent(userId: string, id: string): Promise<EmergencyEvent> {
    const event = ownedOrNotFound(await this.repos.emergencyEvents.get(id), userId, 'Evento de emergencia');
    if (event.status === 'resolved' || event.status === 'false_alarm') {
      throw new ConflictError('La emergencia ya fue cerrada');
    }
    return event;
  }

  async resolve(userId: string, id: string): Promise<EmergencyEvent> {
    const event = await this.openEvent(userId, id);
    const now = this.now();
    if (event.seizureId) {
      const seizure = await this.repos.seizures.get(event.seizureId);
      if (seizure) {
        await this.repos.seizures.update(seizure.id, {
          resolvedAt: now.toISOString(),
          durationSeconds: Math.max(0, Math.round((now.getTime() - Date.parse(seizure.startedAt)) / 1000)),
        });
        this.seizures.invalidate(userId);
      }
    }
    await this.audit.record(userId, 'emergency.resolve', 'emergency_event', id);
    return (await this.repos.emergencyEvents.update(id, { status: 'resolved' })) as EmergencyEvent;
  }

  /** Falsa alarma: se elimina la crisis asociada para no contaminar estadísticas. */
  async falseAlarm(userId: string, id: string): Promise<EmergencyEvent> {
    const event = await this.openEvent(userId, id);
    const updated = (await this.repos.emergencyEvents.update(id, { status: 'false_alarm', seizureId: null })) as EmergencyEvent;
    if (event.seizureId) {
      await this.repos.seizures.delete(event.seizureId);
      this.seizures.invalidate(userId);
    }
    await this.audit.record(userId, 'emergency.false_alarm', 'emergency_event', id);
    return updated;
  }
}
