import { Router } from 'express';
import type { AppContext } from '../../container';
import { asyncHandler } from '../../http/asyncHandler';

const startedAt = Date.now();

export function healthRoutes(ctx: AppContext): Router {
  const r = Router();
  r.get(
    '/',
    asyncHandler(async (_req, res) => {
      const db = await ctx.healthCheck();
      res.status(db ? 200 : 503).json({
        status: db ? 'ok' : 'degraded',
        db,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        version: process.env.npm_package_version ?? '1.0.0',
      });
    }),
  );
  return r;
}
