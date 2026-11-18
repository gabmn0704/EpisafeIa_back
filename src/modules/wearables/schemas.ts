import { z } from 'zod';

export const deviceCreateSchema = z.object({
  provider: z.enum(['web_bluetooth', 'fitbit', 'google_health', 'apple_health', 'garmin', 'manual']),
  deviceName: z.string().trim().max(120).nullish(),
  externalId: z.string().trim().max(200).nullish(),
});

const sampleSchema = z.object({
  sampledAt: z.string().datetime({ offset: true }),
  heartRate: z.number().int().min(20).max(250).nullish(),
  hrvMs: z.number().min(0).max(500).nullish(),
  spo2: z.number().min(50).max(100).nullish(),
  motionIntensity: z.number().min(0).max(1).nullish(),
  skinTempC: z.number().min(25).max(45).nullish(),
  steps: z.number().int().min(0).max(100_000).nullish(),
});

export const MAX_BATCH = 200;

export const samplesBatchSchema = z.object({
  deviceId: z.string().uuid().nullish(),
  samples: z.array(sampleSchema).min(1, 'Envía al menos una muestra').max(MAX_BATCH, `Máximo ${MAX_BATCH} muestras por lote`),
});

export const liveQuerySchema = z.object({ minutes: z.coerce.number().int().min(1).max(60).default(10) });

export const summaryQuerySchema = z.object({ hours: z.coerce.number().int().min(1).max(168).default(24) });

export type DeviceCreate = z.infer<typeof deviceCreateSchema>;
export type SamplesBatch = z.infer<typeof samplesBatchSchema>;
