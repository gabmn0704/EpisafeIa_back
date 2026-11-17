import type { WearableAlert, WearableAlertKind, WearableDevice, WearableSample } from '../../domain/types';
import { ConflictError } from '../../errors';
import { ownedOrNotFound } from '../../http/ownership';
import type { Repos } from '../../repositories/Repos';
import { CircularBuffer } from '../../structures/CircularBuffer';
import { HashTable } from '../../structures/HashTable';
import type { EventBus } from '../../services/EventBus';
import type { EmergencyService } from '../emergency/EmergencyService';
import { evaluateWindow } from './rules';
import type { DeviceCreate, SamplesBatch } from './schemas';

/** Capacidad de la ventana en vivo por usuario (~10 min a 1 muestra/s). */
export const LIVE_CAPACITY = 600;
/** Tiempo mínimo entre alertas del mismo tipo para un usuario. */
export const ALERT_COOLDOWN_MS = 5 * 60_000;

export interface IngestResult {
  accepted: number;
  alerts: WearableAlert[];
}

export interface WearableSummary {
  hours: number;
  samples: number;
  heartRate: { avg: number | null; min: number | null; max: number | null };
  avgHrvMs: number | null;
  avgSpo2: number | null;
  maxMotion: number | null;
  steps: number;
  hourly: { hour: string; avgHeartRate: number | null; samples: number }[];
}

const avg = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

export class WearablesService {
  /** Ventanas circulares en vivo por usuario. */
  private live = new HashTable<CircularBuffer<WearableSample>>();
  /** Último instante de alerta por usuario y tipo (enfriamiento). */
  private lastAlert = new HashTable<number>();

  constructor(
    private readonly repos: Repos,
    private readonly bus: EventBus,
    private readonly emergency: EmergencyService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  listDevices(userId: string): Promise<WearableDevice[]> {
    return this.repos.devices.find({ where: { userId }, orderBy: 'deviceName' });
  }

  createDevice(userId: string, input: DeviceCreate): Promise<WearableDevice> {
    return this.repos.devices.insert({
      userId,
      provider: input.provider,
      deviceName: input.deviceName ?? null,
      externalId: input.externalId ?? null,
      lastSeenAt: null,
      active: true,
    });
  }

  async removeDevice(userId: string, id: string): Promise<void> {
    ownedOrNotFound(await this.repos.devices.get(id), userId, 'Dispositivo');
    await this.repos.devices.delete(id);
  }

  /** Obtiene la ventana en vivo; si está fría (reinicio) la hidrata desde la base de datos. */
  private async buffer(userId: string): Promise<CircularBuffer<WearableSample>> {
    const existing = this.live.get(userId);
    if (existing) return existing;
    const buf = new CircularBuffer<WearableSample>(LIVE_CAPACITY);
    const recent = await this.repos.samples.find({ where: { userId }, orderBy: 'sampledAt', desc: true, limit: LIVE_CAPACITY });
    recent.reverse().forEach((s) => buf.push(s));
    this.live.set(userId, buf);
    return buf;
  }

  /** Ingesta por lotes: guarda, actualiza la ventana en vivo y evalúa reglas en streaming. */
  async ingest(userId: string, input: SamplesBatch): Promise<IngestResult> {
    if (input.deviceId) {
      const device = ownedOrNotFound(await this.repos.devices.get(input.deviceId), userId, 'Dispositivo');
      await this.repos.devices.update(device.id, { lastSeenAt: this.now().toISOString() });
    }
    const buf = await this.buffer(userId);
    const sorted = [...input.samples].sort((a, b) => Date.parse(a.sampledAt) - Date.parse(b.sampledAt));
    const alerts: WearableAlert[] = [];

    for (const s of sorted) {
      const stored = await this.repos.samples.insert({
        userId,
        deviceId: input.deviceId ?? null,
        sampledAt: new Date(s.sampledAt).toISOString(),
        heartRate: s.heartRate ?? null,
        hrvMs: s.hrvMs ?? null,
        spo2: s.spo2 ?? null,
        motionIntensity: s.motionIntensity ?? null,
        skinTempC: s.skinTempC ?? null,
        steps: s.steps ?? null,
      });
      buf.push(stored);
      for (const detected of evaluateWindow(buf.last(30))) {
        if (!this.cooledDown(userId, detected.kind, Date.parse(detected.detectedAt))) continue;
        const alert = await this.repos.alerts.insert({
          userId,
          deviceId: input.deviceId ?? null,
          detectedAt: detected.detectedAt,
          kind: detected.kind,
          confidence: detected.confidence,
          payload: detected.payload,
          convertedEventId: null,
        });
        alerts.push(alert);
        this.bus.publish({ userId, name: 'wearable_alert', data: alert });
      }
    }
    return { accepted: sorted.length, alerts };
  }

  private cooledDown(userId: string, kind: WearableAlertKind, at: number): boolean {
    const key = `${userId}:${kind}`;
    const last = this.lastAlert.get(key);
    if (last !== undefined && at - last < ALERT_COOLDOWN_MS) return false;
    this.lastAlert.set(key, at);
    return true;
  }

  /** Muestras de la ventana circular de los últimos N minutos. */
  async liveWindow(userId: string, minutes: number): Promise<WearableSample[]> {
    const buf = await this.buffer(userId);
    const latest = buf.latest();
    // La referencia temporal es la muestra más reciente (los relojes pueden tener desfase de reloj).
    const ref = Math.max(this.now().getTime(), latest ? Date.parse(latest.sampledAt) : 0);
    return buf.filter((s) => ref - Date.parse(s.sampledAt) <= minutes * 60_000);
  }

  /** Pulso actual: última muestra con frecuencia cardiaca en los últimos 5 min. */
  async currentHeartRate(userId: string): Promise<number | null> {
    const recent = await this.liveWindow(userId, 5);
    for (let i = recent.length - 1; i >= 0; i--) {
      const hr = (recent[i] as WearableSample).heartRate;
      if (hr !== null) return hr;
    }
    return null;
  }

  async summary(userId: string, hours: number): Promise<WearableSummary> {
    const from = new Date(this.now().getTime() - hours * 3_600_000).toISOString();
    const samples = await this.repos.samples.find({ where: { userId }, range: { field: 'sampledAt', from }, orderBy: 'sampledAt' });
    const hrs = samples.map((s) => s.heartRate).filter((v): v is number => v !== null);
    const motion = samples.map((s) => s.motionIntensity).filter((v): v is number => v !== null);
    const byHour = new HashTable<number[]>();
    for (const s of samples) {
      const h = s.sampledAt.slice(0, 13) + ':00:00Z';
      const arr = byHour.getOrSet(h, () => []);
      if (s.heartRate !== null) arr.push(s.heartRate);
      else arr.push(NaN);
    }
    const hourly = byHour
      .keys()
      .sort()
      .map((hour) => {
        const vals = byHour.get(hour) as number[];
        return { hour, avgHeartRate: avg(vals.filter((v) => !Number.isNaN(v))), samples: vals.length };
      });
    return {
      hours,
      samples: samples.length,
      heartRate: { avg: avg(hrs), min: hrs.length ? Math.min(...hrs) : null, max: hrs.length ? Math.max(...hrs) : null },
      avgHrvMs: avg(samples.map((s) => s.hrvMs).filter((v): v is number => v !== null)),
      avgSpo2: avg(samples.map((s) => s.spo2).filter((v): v is number => v !== null)),
      maxMotion: motion.length ? Math.max(...motion) : null,
      steps: samples.reduce((a, s) => a + (s.steps ?? 0), 0),
      hourly,
    };
  }

  alerts(userId: string, limit = 50): Promise<WearableAlert[]> {
    return this.repos.alerts.find({ where: { userId }, orderBy: 'detectedAt', desc: true, limit });
  }

  /** Alertas sin convertir de las últimas 24 h (para el dashboard). */
  async activeAlerts(userId: string): Promise<WearableAlert[]> {
    const since = new Date(this.now().getTime() - 24 * 3_600_000).toISOString();
    const recent = await this.repos.alerts.find({ where: { userId }, range: { field: 'detectedAt', from: since }, orderBy: 'detectedAt', desc: true });
    return recent.filter((a) => a.convertedEventId === null);
  }

  /** Convierte una alerta del reloj en una emergencia real. */
  async escalate(userId: string, alertId: string) {
    const alert = ownedOrNotFound(await this.repos.alerts.get(alertId), userId, 'Alerta');
    if (alert.convertedEventId) throw new ConflictError('La alerta ya fue escalada');
    const outcome = await this.emergency.trigger(userId, { source: 'wearable', note: `Alerta del reloj: ${alert.kind}` });
    const updated = await this.repos.alerts.update(alert.id, { convertedEventId: outcome.event.id });
    return { alert: updated ?? alert, emergency: outcome };
  }
}
