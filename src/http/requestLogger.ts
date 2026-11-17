import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';

/** Asigna un id de petición (X-Request-Id) y registra método, ruta, estado y duración. */
export const requestLogger =
  (log: Logger): RequestHandler =>
  (req, res, next) => {
    const id = (req.header('x-request-id') ?? '').slice(0, 64) || randomUUID();
    res.setHeader('X-Request-Id', id);
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      log.info({ reqId: id, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) }, 'request');
    });
    next();
  };
