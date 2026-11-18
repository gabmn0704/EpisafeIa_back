import { describe, expect, it } from 'vitest';
import { DailyLogTemplate } from '../../src/patterns/Prototype';

describe('DailyLogTemplate (Prototype)', () => {
  it('clones without sharing state', () => {
    const a = DailyLogTemplate.defaults();
    const b = a.clone();
    b.fields.sleepHours = 3;
    expect(a.fields.sleepHours).toBe(8);
    expect(b).not.toBe(a);
  });

  it('applies overrides ignoring undefined', () => {
    const t = DailyLogTemplate.defaults().with({ stressLevel: 9, mood: undefined });
    expect(t.fields.stressLevel).toBe(9);
    expect(t.fields.mood).toBe(3);
  });

  it('builds from an existing log', () => {
    const t = DailyLogTemplate.fromLog({ caffeineMg: 200 });
    expect(t.fields.caffeineMg).toBe(200);
    expect(t.fields.sleepHours).toBe(8);
  });
});
