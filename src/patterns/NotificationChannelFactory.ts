import type { Logger } from 'pino';
import type { NotificationChannelName } from '../domain/types';

export interface OutgoingNotification {
  to: string;
  subject: string;
  body: string;
}

export interface DeliveryResult {
  ok: boolean;
  detail: string;
}

export interface NotificationChannel {
  readonly name: NotificationChannelName;
  send(msg: OutgoingNotification): Promise<DeliveryResult>;
}

/**
 * Canales simulados: registran el envío en el log estructurado. En producción
 * se sustituyen por proveedores reales (SES, SNS, FCM) registrando otra
 * implementación en la fábrica sin tocar el resto del código.
 */
abstract class LoggingChannel implements NotificationChannel {
  abstract readonly name: NotificationChannelName;

  constructor(protected readonly log: Logger) {}

  protected validate(_msg: OutgoingNotification): string | null {
    return null;
  }

  async send(msg: OutgoingNotification): Promise<DeliveryResult> {
    const problem = this.validate(msg);
    if (problem) return { ok: false, detail: problem };
    this.log.info({ channel: this.name, to: msg.to, subject: msg.subject }, 'notification dispatched (simulated)');
    return { ok: true, detail: `simulated:${this.name}` };
  }
}

export class EmailChannel extends LoggingChannel {
  readonly name = 'email' as const;
  protected override validate(msg: OutgoingNotification): string | null {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.to) ? null : 'invalid email address';
  }
}

export class SmsChannel extends LoggingChannel {
  readonly name = 'sms' as const;
  protected override validate(msg: OutgoingNotification): string | null {
    return /^\+?[0-9 ()-]{7,20}$/.test(msg.to) ? null : 'invalid phone number';
  }
}

export class PushChannel extends LoggingChannel {
  readonly name = 'push' as const;
}

export class LogChannel extends LoggingChannel {
  readonly name = 'log' as const;
}

/** Patrón Factory: crea (y reutiliza) el canal adecuado según su nombre. */
export class NotificationChannelFactory {
  private readonly instances = new Map<NotificationChannelName, NotificationChannel>();

  constructor(private readonly log: Logger) {}

  create(name: NotificationChannelName): NotificationChannel {
    const existing = this.instances.get(name);
    if (existing) return existing;
    let channel: NotificationChannel;
    switch (name) {
      case 'email':
        channel = new EmailChannel(this.log);
        break;
      case 'sms':
        channel = new SmsChannel(this.log);
        break;
      case 'push':
        channel = new PushChannel(this.log);
        break;
      case 'log':
        channel = new LogChannel(this.log);
        break;
      default:
        throw new Error(`Unknown notification channel: ${String(name)}`);
    }
    this.instances.set(name, channel);
    return channel;
  }
}
