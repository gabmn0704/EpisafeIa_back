import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  AI_SERVICE_URL: z.string().url().default('http://localhost:5000'),
  AI_API_KEY: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  logLevel: string;
  corsOrigins: string[];
  databaseUrl?: string;
  dbPoolMax: number;
  jwtSecret: string;
  accessTokenTtl: string;
  refreshTokenTtlDays: number;
  bcryptRounds: number;
  aiServiceUrl: string;
  aiApiKey?: string;
  aiTimeoutMs: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

/** Valida y normaliza variables de entorno. Lanza si falta algo obligatorio. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida: ${msg}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    corsOrigins: e.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    databaseUrl: e.DATABASE_URL || undefined,
    dbPoolMax: e.DB_POOL_MAX,
    jwtSecret: e.JWT_SECRET,
    accessTokenTtl: e.ACCESS_TOKEN_TTL,
    refreshTokenTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
    bcryptRounds: e.BCRYPT_ROUNDS,
    aiServiceUrl: e.AI_SERVICE_URL.replace(/\/$/, ''),
    aiApiKey: e.AI_API_KEY || undefined,
    aiTimeoutMs: e.AI_TIMEOUT_MS,
    rateLimitWindowMs: e.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: e.RATE_LIMIT_MAX,
  };
}
