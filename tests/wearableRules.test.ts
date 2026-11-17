import { describe, expect, it } from 'vitest';
import type { WearableSample } from '../src/domain/types';
import {
  detectConvulsiveMotion,
  detectFall,
  detectHrAnomaly,
  detectTachycardia,
  evaluateWindow,
  median,
  robustZ,
} from '../src/modules/wearables/rules';

let n = 0;
const sample = (hr: number | null, motion: number | null = 0.1): WearableSample => ({
  id: String(++n),
  userId: 'u',
  deviceId: null,
  sampledAt: new Date(Date.UTC(2024, 4, 1, 12, 0, n)).toISOString(),
  heartRate: hr,
  hrvMs: null,
  spo2: null,
  motionIntensity: motion,
  skinTempC: null,
  steps: null,
});

describe('wearable rules', () => {
  it('computes median and robust z-score', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(robustZ(100, [60, 61, 62, 60, 61])).toBeGreaterThan(10);
    expect(robustZ(5, [5, 5, 5])).toBe(0);
  });

  it('detects sustained tachycardia at rest only', () => {
    const resting = Array.from({ length: 5 }, () => sample(135, 0.1));
    expect(detectTachycardia(resting)?.kind).toBe('tachycardia');
    expect(detectTachycardia(resting.slice(1))).toBeNull();
    const exercising = Array.from({ length: 5 }, () => sample(150, 0.8));
    expect(detectTachycardia(exercising)).toBeNull();
    const interrupted = [...resting.slice(0, 4), sample(80)];
    expect(detectTachycardia(interrupted)).toBeNull();
  });

  it('detects convulsive movement when most recent samples show high motion', () => {
    const shaking = [0.1, 0.8, 0.9, 0.85, 0.8, 0.9].map((m) => sample(100, m));
    const alert = detectConvulsiveMotion(shaking);
    expect(alert?.kind).toBe('motion_convulsive');
    expect(alert?.confidence).toBeGreaterThan(0.7);
    expect(detectConvulsiveMotion([0.1, 0.8, 0.1, 0.2, 0.1, 0.1].map((m) => sample(80, m)))).toBeNull();
    expect(detectConvulsiveMotion(shaking.slice(2))).toBeNull();
  });

  it('detects falls as impact followed by stillness', () => {
    expect(detectFall([sample(80, 0.95), sample(85, 0.05)])?.kind).toBe('fall');
    expect(detectFall([sample(80, 0.95), sample(85, 0.6)])).toBeNull();
    expect(detectFall([sample(80, 0.5), sample(85, 0.05)])).toBeNull();
    expect(detectFall([sample(80, 0.95)])).toBeNull();
  });

  it('detects heart rate anomalies using MAD', () => {
    const base = [60, 62, 61, 63, 60, 62, 61, 60, 62, 61].map((h) => sample(h));
    expect(detectHrAnomaly([...base, sample(61)])).toBeNull();
    const alert = detectHrAnomaly([...base, sample(150)]);
    expect(alert?.kind).toBe('hr_anomaly');
    expect(detectHrAnomaly(base.slice(0, 5))).toBeNull();
  });

  it('evaluateWindow aggregates alerts and ignores missing values', () => {
    expect(evaluateWindow([sample(null, null), sample(null, null)])).toEqual([]);
    const win = Array.from({ length: 6 }, () => sample(140, 0.9));
    const kinds = evaluateWindow(win).map((a) => a.kind);
    expect(kinds).toContain('motion_convulsive');
  });
});
