import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler';
import { currentUser } from '../../http/auth';
import { idParamSchema } from '../contacts/schemas';
import type { MedicationsService } from './MedicationsService';
import {
  adherenceQuerySchema,
  doseLogSchema,
  medicationCreateSchema,
  medicationUpdateSchema,
  searchQuerySchema,
} from './schemas';

export function medicationsRoutes(service: MedicationsService): Router {
  const r = Router();

  r.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json({ medications: await service.list(currentUser(req).id) });
    }),
  );

  r.post(
    '/',
    asyncHandler(async (req, res) => {
      const medication = await service.create(currentUser(req).id, medicationCreateSchema.parse(req.body));
      res.status(201).json({ medication });
    }),
  );

  r.get(
    '/search',
    asyncHandler(async (req, res) => {
      const { q, limit } = searchQuerySchema.parse(req.query);
      res.json({ query: q, results: await service.search(currentUser(req).id, q, limit) });
    }),
  );

  r.get(
    '/schedule/today',
    asyncHandler(async (req, res) => {
      res.json({ doses: await service.scheduleToday(currentUser(req).id) });
    }),
  );

  r.post(
    '/logs',
    asyncHandler(async (req, res) => {
      res.status(201).json({ log: await service.logDose(currentUser(req).id, doseLogSchema.parse(req.body)) });
    }),
  );

  r.get(
    '/adherence',
    asyncHandler(async (req, res) => {
      const { days } = adherenceQuerySchema.parse(req.query);
      res.json(await service.adherence(currentUser(req).id, days));
    }),
  );

  r.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json({ medication: await service.update(currentUser(req).id, id, medicationUpdateSchema.parse(req.body)) });
    }),
  );

  r.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      await service.remove(currentUser(req).id, id);
      res.status(204).end();
    }),
  );

  return r;
}
