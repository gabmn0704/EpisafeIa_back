import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado YYYY-MM-DD');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido').max(254),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128)
    .regex(/[A-Za-z]/, 'Debe incluir una letra')
    .regex(/[0-9]/, 'Debe incluir un número'),
  fullName: z.string().trim().min(2, 'Nombre demasiado corto').max(120),
  birthDate: dateOnly.optional(),
  timezone: z.string().max(64).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(1, 'Contraseña requerida').max(128),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

export const logoutSchema = z.object({ refreshToken: z.string().max(200).optional() });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
