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

/** Desfase (ms) de una zona horaria respecto a UTC en un instante dado. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Convierte fecha local (YYYY-MM-DD) + hora local (HH:MM) en un instante UTC. */
export function zonedTimeToUtc(date: string, time: string, timeZone = 'UTC'): Date {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  try {
    let result = naive - zoneOffsetMs(new Date(naive), timeZone);
    result = naive - zoneOffsetMs(new Date(result), timeZone);
    return new Date(result);
  } catch {
    return new Date(naive);
  }
}
