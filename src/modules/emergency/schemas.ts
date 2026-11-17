import { z } from 'zod';

export const emergencySchema = z.object({
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  note: z.string().trim().max(500).nullish(),
});

export type EmergencyInput = z.infer<typeof emergencySchema>;
