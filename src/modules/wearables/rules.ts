import type { WearableAlertKind, WearableSample } from '../../domain/types';

export interface DetectedAlert {
  kind: WearableAlertKind;
  confidence: number;
  detectedAt: string;
  payload: Record<string, unknown>;
}

export const RULES = {
  tachycardiaBpm: 120,
  tachycardiaSamples: 5,
  convulsiveMotion: 0.7,
  convulsiveWindow: 6,
  convulsiveMin: 4,
  fallImpact: 0.9,
  fallStill: 0.1,
  anomalyZ: 3.5,
  anomalyMinWindow: 10,
} as const;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Puntaje z robusto (mediana y MAD escalada). Devuelve 0 si no hay dispersión. */
export function robustZ(value: number, window: number[]): number {
  const med = median(window);
  const mad = median(window.map((v) => Math.abs(v - med))) * 1.4826;
  if (!mad) return 0;
  return (value - med) / mad;
}

/** Taquicardia sostenida en reposo: N muestras seguidas con FC alta y poco movimiento. */
export function detectTachycardia(window: WearableSample[]): DetectedAlert | null {
  const n = RULES.tachycardiaSamples;
  if (window.length < n) return null;
  const tail = window.slice(-n);
  const sustained = tail.every((s) => s.heartRate !== null && s.heartRate >= RULES.tachycardiaBpm && (s.motionIntensity ?? 0) < 0.5);
  if (!sustained) return null;
  const avg = tail.reduce((a, s) => a + (s.heartRate as number), 0) / n;
  return {
    kind: 'tachycardia',
    confidence: round2(clamp01(0.5 + (avg - RULES.tachycardiaBpm) / 60)),
    detectedAt: (tail[n - 1] as WearableSample).sampledAt,
    payload: { avgHeartRate: Math.round(avg), samples: n },
  };
}

/** Movimiento convulsivo: gran parte de las últimas muestras con intensidad alta. */
export function detectConvulsiveMotion(window: WearableSample[]): DetectedAlert | null {
  const tail = window.slice(-RULES.convulsiveWindow);
  if (tail.length < RULES.convulsiveWindow) return null;
  const high = tail.filter((s) => (s.motionIntensity ?? 0) >= RULES.convulsiveMotion);
  if (high.length < RULES.convulsiveMin) return null;
  const avg = high.reduce((a, s) => a + (s.motionIntensity as number), 0) / high.length;
  return {
    kind: 'motion_convulsive',
    confidence: round2(clamp01((high.length / tail.length) * 0.6 + avg * 0.4)),
    detectedAt: (tail[tail.length - 1] as WearableSample).sampledAt,
    payload: { highMotionSamples: high.length, window: tail.length, avgIntensity: round2(avg) },
  };
}

/** Caída: impacto fuerte seguido de inmovilidad en la muestra siguiente. */
export function detectFall(window: WearableSample[]): DetectedAlert | null {
  if (window.length < 2) return null;
  const last = window[window.length - 1] as WearableSample;
  const prev = window[window.length - 2] as WearableSample;
  if ((prev.motionIntensity ?? 0) >= RULES.fallImpact && last.motionIntensity !== null && last.motionIntensity <= RULES.fallStill) {
    return {
      kind: 'fall',
      confidence: round2(clamp01(0.6 + ((prev.motionIntensity ?? 0) - RULES.fallImpact) * 4)),
      detectedAt: last.sampledAt,
      payload: { impact: prev.motionIntensity, afterwards: last.motionIntensity },
    };
  }
  return null;
}

/** Anomalía de FC respecto al comportamiento reciente (z-score robusto con MAD). */
export function detectHrAnomaly(window: WearableSample[]): DetectedAlert | null {
  const hrs = window.filter((s) => s.heartRate !== null);
  if (hrs.length < RULES.anomalyMinWindow) return null;
  const latest = hrs[hrs.length - 1] as WearableSample;
  const baseline = hrs.slice(0, -1).map((s) => s.heartRate as number);
  const z = robustZ(latest.heartRate as number, baseline);
  if (Math.abs(z) < RULES.anomalyZ) return null;
  return {
    kind: 'hr_anomaly',
    confidence: round2(clamp01(Math.abs(z) / (RULES.anomalyZ * 2))),
    detectedAt: latest.sampledAt,
    payload: { heartRate: latest.heartRate, robustZ: round2(z), baselineMedian: median(baseline) },
  };
}

/** Evalúa todas las reglas sobre una ventana cronológica (la última muestra es la más reciente). */
export function evaluateWindow(window: WearableSample[]): DetectedAlert[] {
  return [detectTachycardia(window), detectConvulsiveMotion(window), detectFall(window), detectHrAnomaly(window)].filter(
    (a): a is DetectedAlert => a !== null,
  );
}
