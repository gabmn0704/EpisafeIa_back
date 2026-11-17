import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler';
import { currentUser } from '../../http/auth';
import { idParamSchema } from '../contacts/schemas';
import type { SeizuresService } from './SeizuresService';
import { seizureCreateSchema, seizureListQuerySchema, seizureUpdateSchema } from './schemas';

export function seizuresRoutes(service: SeizuresService): Router {
  const r = Router();

  r.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await service.list(currentUser(req).id, seizureListQuerySchema.parse(req.query)));
    }),
  );

  r.post(
    '/',
    asyncHandler(async (req, res) => {
      const seizure = await service.create(currentUser(req).id, seizureCreateSchema.parse(req.body));
      res.status(201).json({ seizure });
    }),
  );

  r.get(
    '/stats',
    asyncHandler(async (req, res) => {
      res.json(await service.stats(currentUser(req).id));
    }),
  );

  r.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.getWithNavigation(currentUser(req).id, id));
    }),
  );

  r.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json({ seizure: await service.update(currentUser(req).id, id, seizureUpdateSchema.parse(req.body)) });
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
