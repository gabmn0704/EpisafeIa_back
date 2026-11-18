import { Pool, types } from 'pg';
import { logger } from '../config/logger';

// date -> 'YYYY-MM-DD'; numeric -> number; bigint -> string (ids bigserial)
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => parseFloat(v));

/**
 * Patrón Singleton: un único pool de conexiones PostgreSQL por proceso.
 */
export class Database {
  private static instance: Database | null = null;
  readonly pool: Pool;

  private constructor(connectionString: string, max: number) {
    this.pool = new Pool({ connectionString, max, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
    this.pool.on('error', (err) => logger.error({ err }, 'unexpected pg pool error'));
  }

  static getInstance(connectionString?: string, max = 10): Database {
    if (!Database.instance) {
      if (!connectionString) throw new Error('DATABASE_URL requerido para inicializar el pool');
      Database.instance = new Database(connectionString, max);
    }
    return Database.instance;
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  static async close(): Promise<void> {
    if (Database.instance) {
      await Database.instance.pool.end();
      Database.instance = null;
    }
  }
}
