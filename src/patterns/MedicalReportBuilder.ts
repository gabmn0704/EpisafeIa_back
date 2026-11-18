export interface ReportPatient {
  fullName: string;
  birthDate: string | null;
  email: string;
}

export interface ReportSeizureSummary {
  total: number;
  avgDurationSeconds: number | null;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  topTriggers: { name: string; count: number }[];
  items: { startedAt: string; durationSeconds: number | null; severity: number | null; seizureType: string | null; triggers: string[] }[];
}

export interface ReportMedication {
  name: string;
  dose: string | null;
  unit: string | null;
  scheduleTimes: string[];
  adherenceRate: number | null;
}

export interface ReportLifestyle {
  daysLogged: number;
  avgSleepHours: number | null;
  minSleepHours: number | null;
  avgStress: number | null;
  avgCaffeineMg: number | null;
  shortSleepDays: number;
}

export interface ReportRisk {
  avgScore: number | null;
  maxScore: number | null;
  highRiskDays: number;
}

export interface MedicalReport {
  title: string;
  generatedAt: string;
  period: { from: string; to: string };
  patient: ReportPatient;
  seizures: ReportSeizureSummary;
  medications: ReportMedication[];
  lifestyle: ReportLifestyle;
  risk: ReportRisk;
  notes: string[];
  disclaimer: string;
}

const DISCLAIMER =
  'Este informe es un resumen de los datos registrados por la persona usuaria y no constituye un diagnóstico médico. ' +
  'Cualquier decisión sobre el tratamiento o la dosis de medicamentos debe tomarla un profesional de la salud.';

const emptySeizures: ReportSeizureSummary = { total: 0, avgDurationSeconds: null, bySeverity: {}, byType: {}, topTriggers: [], items: [] };
const emptyLifestyle: ReportLifestyle = { daysLogged: 0, avgSleepHours: null, minSleepHours: null, avgStress: null, avgCaffeineMg: null, shortSleepDays: 0 };
const emptyRisk: ReportRisk = { avgScore: null, maxScore: null, highRiskDays: 0 };

/**
 * Patrón Builder: construye el informe médico paso a paso. Cada sección es
 * opcional; `build` valida lo imprescindible (paciente y periodo).
 */
export class MedicalReportBuilder {
  private patient?: ReportPatient;
  private period?: { from: string; to: string };
  private seizures: ReportSeizureSummary = emptySeizures;
  private medications: ReportMedication[] = [];
  private lifestyle: ReportLifestyle = emptyLifestyle;
  private risk: ReportRisk = emptyRisk;
  private notes: string[] = [];
  private title = 'Informe de seguimiento de epilepsia';

  constructor(private readonly now: () => Date = () => new Date()) {}

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  forPatient(patient: ReportPatient): this {
    this.patient = patient;
    return this;
  }

  forPeriod(from: string, to: string): this {
    if (from > to) throw new RangeError('El inicio del periodo debe ser anterior al fin');
    this.period = { from, to };
    return this;
  }

  addSeizures(summary: ReportSeizureSummary): this {
    this.seizures = summary;
    return this;
  }

  addMedications(meds: ReportMedication[]): this {
    this.medications = meds;
    return this;
  }

  addLifestyle(lifestyle: ReportLifestyle): this {
    this.lifestyle = lifestyle;
    return this;
  }

  addRisk(risk: ReportRisk): this {
    this.risk = risk;
    return this;
  }

  addNote(note: string): this {
    this.notes.push(note);
    return this;
  }

  build(): MedicalReport {
    if (!this.patient) throw new Error('Report requires a patient');
    if (!this.period) throw new Error('Report requires a period');
    return {
      title: this.title,
      generatedAt: this.now().toISOString(),
      period: this.period,
      patient: this.patient,
      seizures: this.seizures,
      medications: this.medications,
      lifestyle: this.lifestyle,
      risk: this.risk,
      notes: [...this.notes],
      disclaimer: DISCLAIMER,
    };
  }
}

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const val = (v: number | string | null, unit = ''): string => (v === null || v === undefined ? '—' : `${v}${unit}`);

/** Renderiza el informe como HTML autocontenido e imprimible (todo el contenido va escapado). */
export function renderReportHtml(r: MedicalReport): string {
  const rows = r.seizures.items
    .map(
      (s) =>
        `<tr><td>${esc(s.startedAt.replace('T', ' ').slice(0, 16))}</td><td>${esc(val(s.durationSeconds, ' s'))}</td><td>${esc(val(s.severity))}</td><td>${esc(val(s.seizureType))}</td><td>${esc(s.triggers.join(', ') || '—')}</td></tr>`,
    )
    .join('');
  const meds = r.medications
    .map(
      (m) =>
        `<tr><td>${esc(m.name)}</td><td>${esc([m.dose, m.unit].filter(Boolean).join(' ') || '—')}</td><td>${esc(m.scheduleTimes.join(', ') || '—')}</td><td>${esc(m.adherenceRate === null ? '—' : Math.round(m.adherenceRate * 100) + '%')}</td></tr>`,
    )
    .join('');
  const triggers = r.seizures.topTriggers.map((t) => `<li>${esc(t.name)} (${esc(t.count)})</li>`).join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(r.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;color:#1b1f23}h1{font-size:1.6rem}h2{margin-top:2rem;border-bottom:1px solid #ccd;padding-bottom:.25rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd;padding:.35rem .5rem;text-align:left;font-size:.9rem}.kpis{display:flex;gap:1rem;flex-wrap:wrap}.kpi{border:1px solid #ccd;border-radius:8px;padding:.5rem 1rem}.disc{margin-top:2rem;font-size:.8rem;color:#555}@media print{body{margin:0}}</style></head>
<body><h1>${esc(r.title)}</h1>
<p><strong>Paciente:</strong> ${esc(r.patient.fullName)} (${esc(r.patient.email)})${r.patient.birthDate ? ` · Nacimiento: ${esc(r.patient.birthDate)}` : ''}<br>
<strong>Periodo:</strong> ${esc(r.period.from)} a ${esc(r.period.to)} · <strong>Generado:</strong> ${esc(r.generatedAt)}</p>
<h2>Crisis</h2>
<div class="kpis"><div class="kpi">Total: <strong>${esc(r.seizures.total)}</strong></div><div class="kpi">Duración media: <strong>${esc(val(r.seizures.avgDurationSeconds, ' s'))}</strong></div></div>
${triggers ? `<p>Desencadenantes frecuentes:</p><ul>${triggers}</ul>` : ''}
${rows ? `<table><thead><tr><th>Fecha</th><th>Duración</th><th>Severidad</th><th>Tipo</th><th>Desencadenantes</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>Sin crisis registradas en el periodo.</p>'}
<h2>Medicación</h2>
${meds ? `<table><thead><tr><th>Medicamento</th><th>Dosis</th><th>Horarios</th><th>Adherencia</th></tr></thead><tbody>${meds}</tbody></table>` : '<p>Sin medicación registrada.</p>'}
<h2>Hábitos</h2>
<ul><li>Días con registro: ${esc(r.lifestyle.daysLogged)}</li><li>Sueño promedio: ${esc(val(r.lifestyle.avgSleepHours, ' h'))} (mínimo ${esc(val(r.lifestyle.minSleepHours, ' h'))}; ${esc(r.lifestyle.shortSleepDays)} días con menos de 5 h)</li><li>Estrés promedio: ${esc(val(r.lifestyle.avgStress, '/10'))}</li><li>Cafeína promedio: ${esc(val(r.lifestyle.avgCaffeineMg, ' mg'))}</li></ul>
<h2>Riesgo estimado</h2>
<ul><li>Puntaje promedio: ${esc(val(r.risk.avgScore))}</li><li>Puntaje máximo: ${esc(val(r.risk.maxScore))}</li><li>Días de riesgo alto o crítico: ${esc(r.risk.highRiskDays)}</li></ul>
${r.notes.length ? `<h2>Notas</h2><ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
<p class="disc">${esc(r.disclaimer)}</p></body></html>`;
}
