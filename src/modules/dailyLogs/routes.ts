import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler';
import { currentUser } from '../../http/auth';
import type { DailyLogsService } from './DailyLogsService';
import { dailyLogUpsertSchema, dateParamSchema, rangeQuerySchema } from './schemas';

export function dailyLogsRoutes(service: DailyLogsService): Router {
  const r = Router();

  r.get(
    '/',
    asyncHandler(async (req, res) => {
      const { from, to } = rangeQuerySchema.parse(req.query);
      res.json({ logs: await service.range(currentUser(req).id, from, to) });
    }),
  );

  r.get(
    '/template',
    asyncHandler(async (req, res) => {
      res.json({ template: (await service.template(currentUser(req).id)).clone().fields });
    }),
  );

  r.post(
    '/undo',
    asyncHandler(async (req, res) => {
      const result = await service.undoLast(currentUser(req).id);
      res.json({ ...result, remainingUndo: service.pendingUndo(currentUser(req).id) });
    }),
  );

  r.get(
    '/:date',
    asyncHandler(async (req, res) => {
      const { date } = dateParamSchema.parse(req.params);
      res.json({ log: await service.get(currentUser(req).id, date) });
    }),
  );

  r.put(
    '/:date',
    asyncHandler(async (req, res) => {
      const { date } = dateParamSchema.parse(req.params);
      const { log, created } = await service.upsert(currentUser(req).id, date, dailyLogUpsertSchema.parse(req.body));
      res.status(created ? 201 : 200).json({ log });
    }),
  );

  return r;
}
