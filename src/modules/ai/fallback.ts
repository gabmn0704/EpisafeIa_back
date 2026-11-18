import type { RiskFactor } from '../../domain/types';
import { Graph } from '../../structures/Graph';
import { MinHeap } from '../../structures/MinHeap';
import { levelFor, round, sigmoid, wilsonInterval } from './stats';
import type { AiInsight, PatternsRequest, RiskRequest, RiskResponse } from './types';

export const FALLBACK_MODEL_VERSION = 'fallback-local-1';
const MIN_SAMPLES = 3;

/** Insights simples calculados localmente cuando el servicio de IA no responde. */
export function localInsights(req: PatternsRequest): AiInsight[] {
  const insights: AiInsight[] = [];
  const sleepByDate = new Map(req.dailyLogs.filter((l) => l.sleepHours !== null).map((l) => [l.logDate, l.sleepHours as number]));

  // 1) Sueño corto vs crisis, comparado con la proporción base de noches cortas.
  const withSleep = req.seizures.filter((s) => sleepByDate.has(s.startedAt.slice(0, 10)));
  const lowSleep = withSleep.filter((s) => (sleepByDate.get(s.startedAt.slice(0, 10)) as number) < 5).length;
  const baseLow = [...sleepByDate.values()].filter((h) => h < 5).length;
  if (withSleep.length >= MIN_SAMPLES && sleepByDate.size > 0) {
    const share = lowSleep / withSleep.length;
    const base = baseLow / sleepByDate.size;
    const lift = base > 0 ? share / base : share > 0 ? Infinity : 0;
    if (share >= 0.4 && lift >= 1.5) {
      const ci = wilsonInterval(lowSleep, withSleep.length);
      insights.push({
        kind: 'sleep_correlation',
        title: 'Dormir poco se asocia con tus crisis',
        body: `El ${Math.round(share * 100)}% de tus crisis ocurrieron tras dormir menos de 5 horas (${lowSleep} de ${withSleep.length}). Comenta este patrón con tu neurólogo.`,
        evidence: { n: withSleep.length, successes: lowSleep, share: round(share), baseRate: round(base), lift: Number.isFinite(lift) ? round(lift) : null, ci95: [round(ci.low), round(ci.high)] },
        confidence: round(ci.low),
      });
    }
  }

  // 2) Dosis omitidas en las 24 h previas a una crisis.
  const missed = req.medicationLogs.filter((m) => m.status === 'missed' || m.status === 'skipped').map((m) => Date.parse(m.scheduledFor));
  if (req.seizures.length >= MIN_SAMPLES && missed.length) {
    const hit = req.seizures.filter((s) => {
      const t = Date.parse(s.startedAt);
      return missed.some((m) => m <= t && t - m <= 86_400_000);
    }).length;
    const share = hit / req.seizures.length;
    if (hit >= MIN_SAMPLES && share >= 0.3) {
      const ci = wilsonInterval(hit, req.seizures.length);
      insights.push({
        kind: 'missed_medication',
        title: 'Dosis omitidas antes de algunas crisis',
        body: `En el ${Math.round(share * 100)}% de tus crisis hubo una dosis omitida en las 24 horas previas. Mantener la adherencia es clave; consulta a tu médico antes de cambiar cualquier dosis.`,
        evidence: { n: req.seizures.length, successes: hit, share: round(share), ci95: [round(ci.low), round(ci.high)] },
        confidence: round(ci.low),
      });
    }
  }

  // 3) Desencadenantes más frecuentes: grafo de co-ocurrencia + top-k con MinHeap.
  const graph = new Graph();
  req.seizures.forEach((s) => s.triggersNoted.length && graph.addCoOccurrence(s.triggersNoted.map((t) => t.toLowerCase())));
  const top = MinHeap.topK(
    graph.nodes().filter((n) => graph.frequency(n) >= MIN_SAMPLES),
    3,
    (a, b) => graph.frequency(b) - graph.frequency(a) || a.localeCompare(b),
  );
  if (top.length) {
    insights.push({
      kind: 'top_triggers',
      title: 'Desencadenantes que más registras',
      body: `Los factores que más anotas antes de una crisis: ${top.map((t) => `${t} (${graph.frequency(t)})`).join(', ')}.`,
      evidence: { triggers: top.map((t) => ({ name: t, count: graph.frequency(t) })), pairs: graph.topEdges(3) },
      confidence: 0.5,
    });
  }

  return MinHeap.topK(insights, 5, (a, b) => b.confidence - a.confidence);
}

/** Puntaje de riesgo logístico con pesos clínicos fijos (prior) para uso sin IA. */
export function localRisk(req: RiskRequest): RiskResponse {
  const { today, history } = req;
  const contribs: RiskFactor[] = [];
  let z = -2.4;
  const add = (name: string, impact: number, detail: string): void => {
    z += impact;
    if (Math.abs(impact) >= 0.05) contribs.push({ name, impact: round(impact), direction: impact >= 0 ? 'up' : 'down', detail });
  };

  if (today.sleepHours !== null) {
    add('sueño', Math.max(0, 7 - today.sleepHours) * 0.5 - (today.sleepHours >= 7 ? 0.2 : 0), `${today.sleepHours} h de sueño`);
  }
  if (today.stressLevel !== null) add('estrés', (today.stressLevel - 5) * 0.18, `Estrés ${today.stressLevel}/10`);
  if (today.caffeineMg !== null) add('cafeína', Math.max(0, today.caffeineMg - 300) * 0.004, `${today.caffeineMg} mg de cafeína`);
  if (today.exerciseMinutes !== null && today.exerciseMinutes >= 20) add('ejercicio', -0.2, `${today.exerciseMinutes} min de ejercicio`);
  if (today.missedMeds > 0) add('dosis omitidas', today.missedMeds * 0.7, `${today.missedMeds} dosis omitida(s) hoy`);
  if (today.hrAvg !== undefined && today.hrAvg !== null && today.hrAvg > 100) add('pulso', (today.hrAvg - 100) * 0.02, `Pulso promedio ${Math.round(today.hrAvg)} lpm`);
  if (history.daysSinceLastSeizure !== null && history.daysSinceLastSeizure <= 3) add('crisis reciente', 0.8, `Última crisis hace ${history.daysSinceLastSeizure} día(s)`);

  const score = Math.round(sigmoid(z) * 100);
  const known = [today.sleepHours, today.stressLevel, today.caffeineMg, today.exerciseMinutes].filter((v) => v !== null).length;
  const factors = MinHeap.topK(contribs, 5, (a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return { score, level: levelFor(score), factors, modelVersion: FALLBACK_MODEL_VERSION, confidence: round(0.3 + known * 0.1) };
}
