import { NotFoundError } from '../errors';

/**
 * Devuelve la fila solo si pertenece al usuario; si no existe o es de otro
 * usuario responde 404 (no revela la existencia del recurso).
 */
export function ownedOrNotFound<T extends { userId: string }>(row: T | undefined, userId: string, what = 'Recurso'): T {
  if (!row || row.userId !== userId) throw new NotFoundError(`${what} no encontrado`);
  return row;
}
