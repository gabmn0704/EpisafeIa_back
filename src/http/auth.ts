import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors';
import type { AuthUser, Role } from '../domain/types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export function verifyAccessToken(token: string, secret: string): AuthUser {
  try {
    const p = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload & Partial<AccessTokenPayload>;
    if (!p.sub || !p.role) throw new Error('malformed');
    return { id: p.sub, role: p.role };
  } catch {
    throw new UnauthorizedError('Token inválido o expirado');
  }
}

/** Exige `Authorization: Bearer <jwt>` y deja el usuario en `req.user`. */
export const requireAuth =
  (secret: string): RequestHandler =>
  (req, _res, next) => {
    const header = req.header('authorization') ?? '';
    const match = /^Bearer (.+)$/i.exec(header);
    if (!match) {
      next(new UnauthorizedError('Falta el token de acceso'));
      return;
    }
    try {
      req.user = verifyAccessToken(match[1] as string, secret);
      next();
    } catch (e) {
      next(e);
    }
  };

/** Devuelve el usuario autenticado o lanza 401 (para handlers ya protegidos). */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
