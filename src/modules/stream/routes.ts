import { Router } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../../errors';
import { verifyAccessToken } from '../../http/auth';
import type { SseHub } from './SseHub';

const querySchema = z.object({ token: z.string().min(10, 'Token requerido') });

/** SSE autenticado por query (?token=) porque EventSource no permite cabeceras. */
export function streamRoutes(hub: SseHub, jwtSecret: string): Router {
  const r = Router();
  r.get('/', (req, res, next) => {
    try {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) throw new UnauthorizedError('Falta el token de acceso');
      const user = verifyAccessToken(parsed.data.token, jwtSecret);
      hub.attach(user.id, res);
    } catch (e) {
      next(e);
    }
  });
  return r;
}
