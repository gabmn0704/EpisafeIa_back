import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ConflictError, ForbiddenError } from '../../src/errors';
import { asyncHandler } from '../../src/http/asyncHandler';
import { createErrorHandler, notFoundHandler } from '../../src/http/errorHandler';

function build() {
  const app = express();
  app.use(express.json({ limit: '10b' }));
  app.get('/zod', asyncHandler(async () => void z.object({ a: z.string() }).parse({})));
  app.get('/conflict', asyncHandler(async () => { throw new ConflictError('dup'); }));
  app.get('/forbidden', asyncHandler(async () => { throw new ForbiddenError(); }));
  app.get('/boom', asyncHandler(async () => { throw new Error('secret internals'); }));
  app.post('/big', (_req, res) => res.send('ok'));
  app.use(notFoundHandler);
  app.use(createErrorHandler(pino({ level: 'silent' })));
  return app;
}

describe('error handler', () => {
  it('maps zod errors to VALIDATION_ERROR with details', async () => {
    const res = await request(build()).get('/zod');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(res.body.error.details[0].path).toBe('a');
  });

  it('maps AppError subclasses', async () => {
    const app = build();
    expect((await request(app).get('/conflict')).body.error.code).toBe('CONFLICT');
    expect((await request(app).get('/forbidden')).status).toBe(403);
  });

  it('hides internals on unexpected errors', async () => {
    const res = await request(build()).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret internals');
  });

  it('returns 413 for oversized bodies', async () => {
    const res = await request(build()).post('/big').send({ data: 'x'.repeat(100) });
    expect(res.status).toBe(413);
  });
});
