import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '../errors';

/** 404 uniforme para rutas inexistentes. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.path}`));
};

/** Convierte cualquier error en { error: { code, message, details } }. */
export const createErrorHandler =
  (log: Logger): ErrorRequestHandler =>
  (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details } });
      return;
    }
    if (err instanceof AppError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details ?? [] } });
      return;
    }
    const status = (err as { status?: number }).status;
    if (status === 400 && (err as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'JSON inválido', details: [] } });
      return;
    }
    if (status === 413) {
      res.status(413).json({ error: { code: 'VALIDATION_ERROR', message: 'Cuerpo demasiado grande', details: [] } });
      return;
    }
    log.error({ err, path: req.path, method: req.method }, 'unhandled error');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor', details: [] } });
  };
