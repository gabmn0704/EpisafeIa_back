import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppContext } from './container';
import { requireAuth } from './http/auth';
import { createErrorHandler, notFoundHandler } from './http/errorHandler';
import { authLimiter, globalLimiter } from './http/rateLimit';
import { requestLogger } from './http/requestLogger';
import { authRoutes } from './modules/auth/routes';
import { healthRoutes } from './modules/health/routes';

export function createApp(ctx: AppContext): Express {
  const { config, log } = ctx;
  const app = express();
  const guard = requireAuth(config.jwtSecret);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)),
      credentials: true,
    }),
  );
  app.use(requestLogger(log));
  app.use(express.json({ limit: '1mb' }));
  if (config.env !== 'test') app.use(globalLimiter(config.rateLimitWindowMs, config.rateLimitMax));

  const v1 = express.Router();
  v1.use('/health', healthRoutes(ctx));
  v1.use('/auth', authLimiter(config.rateLimitWindowMs, 30), authRoutes(ctx.auth, guard));
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(createErrorHandler(log));
  return app;
}
