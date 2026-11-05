// Aggregate report. Reads ONLY from the SQLite store: no adapters, artifacts or network.
import { STAGE_ORDER, type Stage, type StageRunRecord } from './record.ts';
import type { Store } from './store.ts';

export interface ReportRow {
  contender: string;
  stage: Stage;
  runs: number;
  completed: number;
  median_wall_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  telemetry_gaps: string[];
}

export interface ReportOptions {
  includeStub?: boolean;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function buildReport(store: Pick<Store, 'listStageRuns'>, opts: ReportOptions = {}): ReportRow[] {
  const groups = new Map<string, StageRunRecord[]>();
  for (const r of store.listStageRuns()) {
    if (r.contender === 'stub' && !opts.includeStub) continue;
    const k = `${r.contender}\u0000${r.stage}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const rows: ReportRow[] = [];
  for (const recs of groups.values()) {
    const gaps = new Set<string>();
    let tokens = 0;
    let cost = 0;
    for (const r of recs) {
      for (const g of r.telemetry_gaps) gaps.add(g);
      tokens += r.tokens.input + r.tokens.output + r.tokens.cache_read + r.tokens.cache_write;
      cost += r.cost_usd.tokens + r.cost_usd.compute + r.cost_usd.orchestration;
    }
    rows.push({
      contender: recs[0].contender,
      stage: recs[0].stage,
      runs: recs.length,
      completed: recs.filter((r) => r.status === 'completed').length,
      median_wall_ms: median(recs.map((r) => r.wall_ms)),
      total_tokens: tokens,
      total_cost_usd: Math.round(cost * 1e9) / 1e9,
      telemetry_gaps: [...gaps].sort(),
    });
  }
  rows.sort((a, b) => a.contender.localeCompare(b.contender) || STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  return rows;
}

export function renderMarkdown(rows: ReportRow[]): string {
  const head = '| contender | stage | runs | completed | median wall ms | total tokens | total cost USD | telemetry gaps |\n|---|---|---|---|---|---|---|---|';
  if (rows.length === 0) return `${head}\n`;
  const body = rows.map(
    (r) =>
      `| ${r.contender} | ${r.stage} | ${r.runs} | ${r.completed} | ${r.median_wall_ms} | ${r.total_tokens} | ${r.total_cost_usd} | ${r.telemetry_gaps.join(', ') || '(none)'} |`,
  );
  return `${head}\n${body.join('\n')}\n`;
}

export function renderReport(rows: ReportRow[], format: 'md' | 'json'): string {
  return format === 'json' ? JSON.stringify(rows, null, 2) : renderMarkdown(rows);
}
