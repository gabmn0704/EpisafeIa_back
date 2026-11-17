import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

const handler: RequestHandler = (_req, res) => {
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intenta más tarde', details: [] } });
};

/** Límite global por IP. */
export const globalLimiter = (windowMs: number, max: number): RequestHandler =>
  rateLimit({ windowMs, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, handler });

/** Límite más estricto para endpoints de autenticación (anti fuerza bruta). */
export const authLimiter = (windowMs: number, max: number): RequestHandler =>
  rateLimit({ windowMs, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, handler });
