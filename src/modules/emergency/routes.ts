import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler';
import { currentUser } from '../../http/auth';
import { idParamSchema } from '../contacts/schemas';
import type { EmergencyService } from './EmergencyService';
import { emergencySchema } from './schemas';

export function emergencyRoutes(service: EmergencyService): Router {
  const r = Router();

  r.post(
    '/',
    asyncHandler(async (req, res) => {
      const outcome = await service.trigger(currentUser(req).id, emergencySchema.parse(req.body ?? {}));
      res.status(201).json(outcome);
    }),
  );

  r.get(
    '/active',
    asyncHandler(async (req, res) => {
      res.json({ events: await service.active(currentUser(req).id) });
    }),
  );

  r.post(
    '/:id/resolve',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json({ event: await service.resolve(currentUser(req).id, id) });
    }),
  );

  r.post(
    '/:id/false-alarm',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json({ event: await service.falseAlarm(currentUser(req).id, id) });
    }),
  );

  return r;
}
