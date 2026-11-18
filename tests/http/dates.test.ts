import { describe, expect, it } from 'vitest';
import { addDays, dateInZone, dateRange, daysBetween, isDateString } from '../../src/http/dates';

describe('dates', () => {
  it('validates date strings', () => {
    expect(isDateString('2024-02-29')).toBe(true);
    expect(isDateString('2024-13-01')).toBe(false);
    expect(isDateString('24-1-1')).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('computes differences and ranges', () => {
    expect(daysBetween('2024-01-01', '2024-01-31')).toBe(30);
    expect(dateRange('2024-01-30', '2024-02-02')).toEqual(['2024-01-30', '2024-01-31', '2024-02-01', '2024-02-02']);
  });

  it('formats dates in a time zone and falls back on invalid zones', () => {
    const d = new Date('2024-05-01T03:00:00Z');
    expect(dateInZone(d, 'America/Bogota')).toBe('2024-04-30');
    expect(dateInZone(d, 'UTC')).toBe('2024-05-01');
    expect(dateInZone(d, 'Not/AZone')).toBe('2024-05-01');
  });
});

describe('zonedTimeToUtc', () => {
  it('converts Bogota local time (UTC-5) to UTC', async () => {
    const { zonedTimeToUtc } = await import('../../src/http/dates');
    expect(zonedTimeToUtc('2024-05-01', '08:00', 'America/Bogota').toISOString()).toBe('2024-05-01T13:00:00.000Z');
    expect(zonedTimeToUtc('2024-05-01', '22:30', 'America/Bogota').toISOString()).toBe('2024-05-02T03:30:00.000Z');
  });

  it('is identity for UTC and tolerates invalid zones', async () => {
    const { zonedTimeToUtc } = await import('../../src/http/dates');
    expect(zonedTimeToUtc('2024-05-01', '08:00', 'UTC').toISOString()).toBe('2024-05-01T08:00:00.000Z');
    expect(zonedTimeToUtc('2024-05-01', '08:00', 'Bad/Zone').toISOString()).toBe('2024-05-01T08:00:00.000Z');
  });
});
