import pino, { type Logger } from 'pino';

/** Logger estructurado (JSON). Oculta credenciales en cabeceras y cuerpos. */
export function createLogger(level = process.env.LOG_LEVEL ?? 'info'): Logger {
  return pino({
    level,
    base: { service: 'episafe-api' },
    redact: {
      paths: ['req.headers.authorization', 'password', '*.password', 'refreshToken', '*.refreshToken'],
      censor: '[redacted]',
    },
  });
}

export const logger = createLogger();
