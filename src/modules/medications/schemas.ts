import { z } from 'zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora esperada en formato HH:MM');

export const medicationCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(120),
  dose: z.string().trim().max(60).nullish(),
  unit: z.string().trim().max(20).nullish(),
  scheduleTimes: z.array(time).max(12).default([]),
  active: z.boolean().default(true),
  notes: z.string().trim().max(1000).nullish(),
});

export const medicationUpdateSchema = medicationCreateSchema.partial();

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Escribe al menos 1 carácter').max(60),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export const doseLogSchema = z.object({
  medicationId: z.string().uuid(),
  scheduledFor: z.string().datetime({ offset: true }),
  status: z.enum(['taken', 'missed', 'skipped', 'pending']),
});

export const adherenceQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type MedicationCreate = z.infer<typeof medicationCreateSchema>;
export type MedicationUpdate = z.infer<typeof medicationUpdateSchema>;
export type DoseLogInput = z.infer<typeof doseLogSchema>;
