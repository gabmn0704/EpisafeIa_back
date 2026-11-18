import { describe, expect, it } from 'vitest';
import { MedicalReportBuilder, renderReportHtml } from '../../src/patterns/MedicalReportBuilder';

const patient = { fullName: 'Ana <script>alert(1)</script>', birthDate: '1990-01-01', email: 'ana@test.com' };

describe('MedicalReportBuilder', () => {
  it('builds a report with defaults for omitted sections', () => {
    const r = new MedicalReportBuilder(() => new Date('2024-05-01T00:00:00Z')).forPatient(patient).forPeriod('2024-04-01', '2024-04-30').build();
    expect(r.generatedAt).toBe('2024-05-01T00:00:00.000Z');
    expect(r.seizures.total).toBe(0);
    expect(r.medications).toEqual([]);
    expect(r.disclaimer).toMatch(/no constituye un diagnóstico/);
  });

  it('is fluent and keeps added sections and notes', () => {
    const r = new MedicalReportBuilder()
      .withTitle('Custom')
      .forPatient(patient)
      .forPeriod('2024-04-01', '2024-04-30')
      .addMedications([{ name: 'Lamotrigina', dose: '100', unit: 'mg', scheduleTimes: ['08:00'], adherenceRate: 0.9 }])
      .addNote('Nota 1')
      .addNote('Nota 2')
      .build();
    expect(r.title).toBe('Custom');
    expect(r.medications).toHaveLength(1);
    expect(r.notes).toEqual(['Nota 1', 'Nota 2']);
  });

  it('requires patient and period and validates range order', () => {
    expect(() => new MedicalReportBuilder().forPeriod('2024-01-01', '2024-01-02').build()).toThrow(/patient/);
    expect(() => new MedicalReportBuilder().forPatient(patient).build()).toThrow(/period/);
    expect(() => new MedicalReportBuilder().forPeriod('2024-02-01', '2024-01-01')).toThrow(RangeError);
  });

  it('renders HTML escaping user-provided content', () => {
    const r = new MedicalReportBuilder()
      .forPatient(patient)
      .forPeriod('2024-04-01', '2024-04-30')
      .addSeizures({
        total: 1, avgDurationSeconds: 60, bySeverity: {}, byType: {}, topTriggers: [{ name: '<b>x</b>', count: 1 }],
        items: [{ startedAt: '2024-04-02T10:00:00.000Z', durationSeconds: 60, severity: 3, seizureType: null, triggers: ['"a"'] }],
      })
      .build();
    const html = renderReportHtml(r);
    expect(html).toContain('<!doctype html>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('2024-04-02 10:00');
  });
});
