import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/asyncHandler';
import { currentUser } from '../../http/auth';
import type { AiService } from './AiService';

const historyQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

export function aiRoutes(service: AiService): Router {
  const r = Router();

  r.get(
    '/insights',
    asyncHandler(async (req, res) => {
      res.json(await service.insights(currentUser(req).id));
    }),
  );

  r.post(
    '/insights/refresh',
    asyncHandler(async (req, res) => {
      res.json(await service.refresh(currentUser(req).id));
    }),
  );

  r.get(
    '/risk/today',
    asyncHandler(async (req, res) => {
      res.json(await service.riskToday(currentUser(req).id));
    }),
  );

  r.get(
    '/risk/history',
    asyncHandler(async (req, res) => {
      const { days } = historyQuery.parse(req.query);
      res.json({ days, assessments: await service.riskHistory(currentUser(req).id, days) });
    }),
  );

  return r;
}
