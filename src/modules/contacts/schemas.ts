import { z } from 'zod';

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Teléfono inválido');

const base = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(120),
  relationship: z.string().trim().max(60).nullish(),
  phone: phone.nullish(),
  email: z.string().trim().toLowerCase().email('Correo inválido').nullish(),
  priority: z.number().int().min(1).max(99).default(1),
  notifySms: z.boolean().default(true),
  notifyEmail: z.boolean().default(true),
});

const hasChannel = (v: { phone?: string | null; email?: string | null }): boolean => !!v.phone || !!v.email;

export const contactCreateSchema = base.refine(hasChannel, { message: 'Indica teléfono o correo', path: ['phone'] });

export const contactUpdateSchema = base.partial();

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type ContactCreate = z.infer<typeof contactCreateSchema>;
export type ContactUpdate = z.infer<typeof contactUpdateSchema>;
