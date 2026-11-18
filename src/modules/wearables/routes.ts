import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler';
import { currentUser } from '../../http/auth';
import { idParamSchema } from '../contacts/schemas';
import type { WearablesService } from './WearablesService';
import { deviceCreateSchema, liveQuerySchema, samplesBatchSchema, summaryQuerySchema } from './schemas';

export function wearablesRoutes(service: WearablesService): Router {
  const r = Router();

  r.get(
    '/devices',
    asyncHandler(async (req, res) => {
      res.json({ devices: await service.listDevices(currentUser(req).id) });
    }),
  );

  r.post(
    '/devices',
    asyncHandler(async (req, res) => {
      const device = await service.createDevice(currentUser(req).id, deviceCreateSchema.parse(req.body));
      res.status(201).json({ device });
    }),
  );

  r.delete(
    '/devices/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      await service.removeDevice(currentUser(req).id, id);
      res.status(204).end();
    }),
  );

  r.post(
    '/samples',
    asyncHandler(async (req, res) => {
      res.status(201).json(await service.ingest(currentUser(req).id, samplesBatchSchema.parse(req.body)));
    }),
  );

  r.get(
    '/live',
    asyncHandler(async (req, res) => {
      const { minutes } = liveQuerySchema.parse(req.query);
      const samples = await service.liveWindow(currentUser(req).id, minutes);
      res.json({ minutes, count: samples.length, samples });
    }),
  );

  r.get(
    '/summary',
    asyncHandler(async (req, res) => {
      const { hours } = summaryQuerySchema.parse(req.query);
      res.json(await service.summary(currentUser(req).id, hours));
    }),
  );

  r.get(
    '/alerts',
    asyncHandler(async (req, res) => {
      res.json({ alerts: await service.alerts(currentUser(req).id) });
    }),
  );

  r.post(
    '/alerts/:id/escalate',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.status(201).json(await service.escalate(currentUser(req).id, id));
    }),
  );

  return r;
}
