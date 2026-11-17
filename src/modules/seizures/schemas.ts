import { z } from 'zod';

const isoDateTime = z.string().datetime({ offset: true });

export const seizureCreateSchema = z.object({
  startedAt: isoDateTime,
  durationSeconds: z.number().int().min(0).max(86_400).nullish(),
  severity: z.number().int().min(1).max(5).nullish(),
  seizureType: z.string().trim().max(80).nullish(),
  triggersNoted: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  location: z.string().trim().max(200).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  source: z.enum(['manual', 'wearable']).default('manual'),
  resolvedAt: isoDateTime.nullish(),
});

export const seizureUpdateSchema = seizureCreateSchema.partial();

const dateOrDateTime = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha inválida');

export const seizureListQuerySchema = z.object({
  from: dateOrDateTime.optional(),
  to: dateOrDateTime.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SeizureCreate = z.infer<typeof seizureCreateSchema>;
export type SeizureUpdate = z.infer<typeof seizureUpdateSchema>;
