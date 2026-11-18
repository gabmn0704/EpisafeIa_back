import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler';
import { currentUser } from '../../http/auth';
import type { ContactsService } from './ContactsService';
import { contactCreateSchema, contactUpdateSchema, idParamSchema } from './schemas';

export function contactsRoutes(service: ContactsService): Router {
  const r = Router();

  r.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json({ contacts: await service.list(currentUser(req).id) });
    }),
  );

  r.post(
    '/',
    asyncHandler(async (req, res) => {
      const contact = await service.create(currentUser(req).id, contactCreateSchema.parse(req.body));
      res.status(201).json({ contact });
    }),
  );

  r.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json({ contact: await service.update(currentUser(req).id, id, contactUpdateSchema.parse(req.body)) });
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
