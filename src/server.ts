import { createApp } from './app';
import { loadConfig } from './config/env';
import { createLogger } from './config/logger';
import { buildContext } from './container';
import { Database } from './db/Database';
import { seedDemoData } from './devSeed';
import { createMemoryRepos } from './repositories/memory';
import { createPgRepos } from './repositories/pg';
import type { Repos } from './repositories/Repos';

async function main(): Promise<void> {
  const config = loadConfig();
  const log = createLogger(config.logLevel);

  let repos: Repos;
  let healthCheck: (() => Promise<boolean>) | undefined;
  if (config.databaseUrl) {
    const db = Database.getInstance(config.databaseUrl, config.dbPoolMax);
    repos = createPgRepos(db.pool);
    healthCheck = () => db.ping();
    log.info('using PostgreSQL repositories');
  } else {
    if (config.env === 'production') throw new Error('DATABASE_URL es obligatorio en producción');
    repos = createMemoryRepos();
    await seedDemoData(repos, config.bcryptRounds);
    log.warn('DATABASE_URL not set: using in-memory repositories with demo data (demo@episafe.app / Demo1234!)');
  }

  const ctx = buildContext({ config, log, repos, healthCheck });
  await ctx.auth.warmUp();
  const app = createApp(ctx);
  const server = app.listen(config.port, () => log.info({ port: config.port }, 'EpiSafe API listening'));

  const shutdown = (signal: string): void => {
    log.info({ signal }, 'shutting down');
    server.close(async () => {
      await Database.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // El logger puede no existir si falla la configuración.
  process.stderr.write(`Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
