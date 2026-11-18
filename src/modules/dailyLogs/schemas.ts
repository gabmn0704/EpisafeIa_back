import { z } from 'zod';
import { isDateString } from '../../http/dates';

export const dateParamSchema = z.object({
  date: z.string().refine(isDateString, 'Fecha inválida, usa YYYY-MM-DD'),
});

const optionalDate = z.string().refine(isDateString, 'Fecha inválida, usa YYYY-MM-DD').optional();

export const rangeQuerySchema = z
  .object({ from: optionalDate, to: optionalDate })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: '"from" debe ser anterior o igual a "to"', path: ['from'] });

export const dailyLogUpsertSchema = z.object({
  sleepHours: z.number().min(0).max(24).nullish(),
  stressLevel: z.number().int().min(1).max(10).nullish(),
  caffeineMg: z.number().int().min(0).max(3000).nullish(),
  exerciseMinutes: z.number().int().min(0).max(1440).nullish(),
  mood: z.number().int().min(1).max(5).nullish(),
  alcoholUnits: z.number().min(0).max(50).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export type DailyLogInput = z.infer<typeof dailyLogUpsertSchema>;
