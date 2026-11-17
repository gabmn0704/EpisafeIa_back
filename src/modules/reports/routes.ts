import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/asyncHandler';
import { currentUser } from '../../http/auth';
import { isDateString } from '../../http/dates';
import { renderReportHtml } from '../../patterns/MedicalReportBuilder';
import type { ReportsService } from './ReportsService';

const date = z.string().refine(isDateString, 'Fecha inválida, usa YYYY-MM-DD');

const querySchema = z
  .object({ from: date.optional(), to: date.optional(), format: z.enum(['json', 'html']).default('json') })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: '"from" debe ser anterior o igual a "to"', path: ['from'] });

export function reportsRoutes(service: ReportsService): Router {
  const r = Router();

  r.get(
    '/medical',
    asyncHandler(async (req, res) => {
      const { from, to, format } = querySchema.parse(req.query);
      const report = await service.medical(currentUser(req).id, from, to);
      if (format === 'html') {
        res.type('html').send(renderReportHtml(report));
        return;
      }
      res.json({ report });
    }),
  );

  return r;
}
