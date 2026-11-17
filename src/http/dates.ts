/** Utilidades de fechas (UTC salvo que se indique). */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isDateString = (s: string): boolean => DATE_RE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

/** YYYY-MM-DD de un instante en la zona horaria indicada. */
export function dateInZone(d: Date, timeZone = 'UTC'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Diferencia en días (b - a) entre dos fechas YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);
}

/** Lista de fechas inclusive entre from y to. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
