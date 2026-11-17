import { describe, expect, it } from 'vitest';
import type { DailyLog, Seizure } from '../src/domain/types';
import { localInsights, localRisk } from '../src/modules/ai/fallback';

const seizure = (date: string, triggers: string[] = []): Seizure => ({
  id: date, userId: 'u', startedAt: `${date}T10:00:00.000Z`, durationSeconds: 60, severity: 2, seizureType: null,
  triggersNoted: triggers, location: null, notes: null, source: 'manual', resolvedAt: null,
});

const log = (date: string, sleep: number): DailyLog => ({
  id: date, userId: 'u', logDate: date, sleepHours: sleep, stressLevel: null, caffeineMg: null,
  exerciseMinutes: null, mood: null, alcoholUnits: null, notes: null,
});

const days = (n: number) => Array.from({ length: n }, (_, i) => `2024-03-${String(i + 1).padStart(2, '0')}`);

describe('localInsights', () => {
  it('reports the low-sleep pattern with evidence when n >= 3 and lift is high', () => {
    const d = days(20);
    const dailyLogs = d.map((x, i) => log(x, i < 4 ? 4 : 8));
    const seizures = d.slice(0, 4).map((x) => seizure(x));
    const out = localInsights({ seizures, dailyLogs, medicationLogs: [] });
    const sleep = out.find((i) => i.kind === 'sleep_correlation');
    expect(sleep?.body).toContain('100%');
    expect(sleep?.evidence).toMatchObject({ n: 4, successes: 4 });
    expect(sleep?.confidence).toBeGreaterThan(0.4);
  });

  it('stays silent with too little evidence', () => {
    const d = days(10);
    const out = localInsights({ seizures: [seizure(d[0]!), seizure(d[1]!)], dailyLogs: d.map((x) => log(x, 4)), medicationLogs: [] });
    expect(out.find((i) => i.kind === 'sleep_correlation')).toBeUndefined();
  });

  it('does not flag sleep when short nights are common anyway (low lift)', () => {
    const d = days(20);
    const dailyLogs = d.map((x) => log(x, 4));
    const out = localInsights({ seizures: d.slice(0, 5).map((x) => seizure(x)), dailyLogs, medicationLogs: [] });
    expect(out.find((i) => i.kind === 'sleep_correlation')).toBeUndefined();
  });

  it('ranks frequent triggers with the heap', () => {
    const d = days(6);
    const seizures = d.map((x, i) => seizure(x, i < 5 ? ['estres', 'alcohol'] : ['estres']));
    const t = localInsights({ seizures, dailyLogs: [], medicationLogs: [] }).find((i) => i.kind === 'top_triggers');
    expect(t?.body).toMatch(/estres \(6\)/);
    expect(t?.evidence.triggers).toHaveLength(2);
  });
});

const baseToday = { sleepHours: 8, stressLevel: 3, caffeineMg: 100, exerciseMinutes: 30, missedMeds: 0 };
const baseHistory = { seizureCount90d: 0, daysSinceLastSeizure: null, avgSleepHours30d: 8, avgStress30d: 3 };

describe('localRisk', () => {
  it('gives low risk for a healthy day', () => {
    const r = localRisk({ today: baseToday, history: baseHistory });
    expect(r.level).toBe('low');
    expect(r.modelVersion).toBe('fallback-local-1');
  });

  it('raises risk with short sleep, stress and missed doses, listing top factors', () => {
    const r = localRisk({
      today: { ...baseToday, sleepHours: 3, stressLevel: 9, missedMeds: 2, caffeineMg: 600 },
      history: { ...baseHistory, daysSinceLastSeizure: 1 },
    });
    expect(r.score).toBeGreaterThan(80);
    expect(r.factors.length).toBeLessThanOrEqual(5);
    expect(r.factors[0]?.direction).toBe('up');
    expect(r.factors.map((f) => f.name)).toContain('sueño');
  });

  it('is monotonic in sleep and handles missing data', () => {
    const a = localRisk({ today: { ...baseToday, sleepHours: 4 }, history: baseHistory }).score;
    const b = localRisk({ today: { ...baseToday, sleepHours: 7 }, history: baseHistory }).score;
    expect(a).toBeGreaterThan(b);
    const empty = localRisk({
      today: { sleepHours: null, stressLevel: null, caffeineMg: null, exerciseMinutes: null, missedMeds: 0 },
      history: baseHistory,
    });
    expect(empty.confidence).toBeLessThan(0.5);
    expect(empty.score).toBeLessThan(25);
  });
});
