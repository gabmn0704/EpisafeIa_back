export interface Query<T> {
  /** Igualdad exacta por campo. */
  where?: Partial<T>;
  /** Rango inclusivo sobre un campo comparable (ISO strings o números). */
  range?: { field: keyof T; from?: string | number; to?: string | number };
  orderBy?: keyof T;
  desc?: boolean;
  limit?: number;
  offset?: number;
}

export type NewRow<T extends { id: string }> = Omit<T, 'id'> & { id?: string };

/**
 * Repositorio genérico por tabla. Hay dos implementaciones: en memoria
 * (pruebas/desarrollo sin base de datos) y PostgreSQL (producción).
 */
export interface Table<T extends { id: string }> {
  insert(row: NewRow<T>): Promise<T>;
  get(id: string): Promise<T | undefined>;
  update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | undefined>;
  delete(id: string): Promise<boolean>;
  find(query?: Query<T>): Promise<T[]>;
  count(query?: Query<T>): Promise<number>;
  findOne(query: Query<T>): Promise<T | undefined>;
}
