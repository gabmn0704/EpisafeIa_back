import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../http/asyncHandler';
import { currentUser } from '../../http/auth';
import type { AuthService } from './AuthService';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from './schemas';

/** `guard` protege solo las rutas que lo requieren (me). */
export function authRoutes(service: AuthService, guard: RequestHandler): Router {
  const r = Router();

  r.post(
    '/register',
    asyncHandler(async (req, res) => {
      res.status(201).json(await service.register(registerSchema.parse(req.body)));
    }),
  );

  r.post(
    '/login',
    asyncHandler(async (req, res) => {
      res.json(await service.login(loginSchema.parse(req.body)));
    }),
  );

  r.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      res.json(await service.refresh(refreshSchema.parse(req.body).refreshToken));
    }),
  );

  r.post(
    '/logout',
    asyncHandler(async (req, res) => {
      await service.logout(logoutSchema.parse(req.body ?? {}).refreshToken);
      res.json({ ok: true });
    }),
  );

  r.get(
    '/me',
    guard,
    asyncHandler(async (req, res) => {
      res.json({ user: await service.me(currentUser(req).id) });
    }),
  );

  return r;
}
