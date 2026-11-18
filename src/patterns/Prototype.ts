/** Contrato del patrón Prototype. */
export interface Prototype<T> {
  clone(): T;
}

export interface DailyLogFields {
  sleepHours: number | null;
  stressLevel: number | null;
  caffeineMg: number | null;
  exerciseMinutes: number | null;
  mood: number | null;
  alcoholUnits: number | null;
  notes: string | null;
}

/**
 * Plantilla de registro diario: se clona para crear nuevos registros con
 * valores por defecto sin compartir estado entre ellos.
 */
export class DailyLogTemplate implements Prototype<DailyLogTemplate> {
  constructor(readonly fields: DailyLogFields) {}

  static defaults(): DailyLogTemplate {
    return new DailyLogTemplate({
      sleepHours: 8,
      stressLevel: 5,
      caffeineMg: 0,
      exerciseMinutes: 0,
      mood: 3,
      alcoholUnits: 0,
      notes: null,
    });
  }

  clone(): DailyLogTemplate {
    return new DailyLogTemplate({ ...this.fields });
  }

  /** Clona la plantilla aplicando cambios; los valores undefined se ignoran. */
  with(overrides: Partial<DailyLogFields>): DailyLogTemplate {
    const copy = this.clone();
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined) (copy.fields as unknown as Record<string, unknown>)[k] = v;
    }
    return copy;
  }

  /** Construye una plantilla a partir de un registro existente (p. ej. el de ayer). */
  static fromLog(log: Partial<DailyLogFields>): DailyLogTemplate {
    return DailyLogTemplate.defaults().with(log);
  }
}
