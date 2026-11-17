import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler';
import { currentUser } from '../../http/auth';
import type { DashboardService } from './DashboardService';

export function dashboardRoutes(service: DashboardService): Router {
  const r = Router();
  r.get(
    '/summary',
    asyncHandler(async (req, res) => {
      res.json(await service.summary(currentUser(req).id));
    }),
  );
  return r;
}
