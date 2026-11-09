// Read graph/.run-state/telemetry.jsonl and normalise it to StageEvents (spec 006 R6). Pure; no
// imports from graph/src.
import fs from 'node:fs';
import { STAGE_ORDER, type Stage } from '../../record.ts';
import type { StageEvent } from '../types.ts';

/**
 * Line shape written by graph (restated, not imported). Source: graph/src/core/telemetry.ts
 * `StageRunRecordSchema`, written by graph/src/workflow/activities.ts `recordStage`: one line per
 * stage execution (`gate: null`), plus a separate gate-outcome line per gated stage
 * (`gate: {name, decision}`, `wall_ms: 0`). Cache-token and failure fields may be absent from an
 * older graph, so everything the harness does not strictly need is optional.
 */
export interface GraphLine {
  run_id: string;
  stage: Stage;
  started_at: string;
  ended_at: string;
  wall_ms: number;
  active_ms: number;
  waiting_ms: number;
  cold_start_ms?: number;
  model_requested?: string;
  model_served?: string;
  llm_calls?: number;
  tool_calls?: number;
  tokens?: { input?: number; output?: number; cache_read?: number; cache_write?: number; source?: 'reported' | 'estimated' | 'provider_log' };
  cost_usd?: { tokens?: number; compute?: number; orchestration?: number };
  status: 'completed' | 'failed' | 'stopped_by_gate' | 'budget' | 'infra';
  gate?: { name: string; decision: 'pass' | 'fail' } | null;
  output?: { schema_valid?: boolean; artifact_refs?: string[] };
  failure_label?: string | null;
  failure_note?: string | null;
  telemetry_gaps?: string[];
}

/** Read the telemetry file and keep the lines of one run. A missing file is an empty run. */
export function readGraphTelemetry(file: string, runId: string): GraphLine[] {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  const raw = text.split('\n');
  const out: GraphLine[] = [];
  raw.forEach((l, i) => {
    if (!l.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(l);
    } catch {
      // A torn final line (worker killed mid-append) is tolerated; corruption elsewhere is not.
      if (raw.slice(i + 1).every((r) => !r.trim())) return;
      throw new Error(`${file}:${i + 1}: malformed telemetry line`);
    }
    if (parsed && typeof parsed === 'object' && (parsed as GraphLine).run_id === runId) out.push(parsed as GraphLine);
  });
  return out;
}

export interface MapOptions {
  /** Workflow result string. `stopped-invalid-output` (TASK-0022) fails the run's last stage with label `schema`. */
  workflowResult?: string;
}

const num = (n: number | undefined): number => n ?? 0;
const sumDefined = (xs: (number | undefined)[]): number | undefined => {
  const d = xs.filter((x): x is number => x !== undefined);
  return d.length ? d.reduce((a, b) => a + b, 0) : undefined;
};
const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];

function mergeStage(stage: Stage, lines: GraphLine[]): StageEvent {
  const work = lines.filter((l) => !l.gate);
  const gates = lines.filter((l) => l.gate);
  const base = work.length ? work : gates;
  const first = base[0];
  const last = base[base.length - 1];
  const lastGate = gates[gates.length - 1];
  const lastLine = lines[lines.length - 1];

  // Status: the final line's stop wins; earlier gate stops (rejected design rounds) do not leak.
  let status: StageEvent['status'] = last.status;
  if (lastLine.gate && lastLine.status === 'stopped_by_gate') status = 'stopped_by_gate';

  const ev: StageEvent = {
    stage,
    started_at: first.started_at,
    ended_at: base[base.length - 1].ended_at,
    wall_ms: base.reduce((a, l) => a + num(l.wall_ms), 0),
    active_ms: base.reduce((a, l) => a + num(l.active_ms), 0),
    waiting_ms: base.reduce((a, l) => a + num(l.waiting_ms), 0),
    status,
    fix_attempts: Math.max(0, work.length - 1),
    telemetry_gaps: uniq(work.flatMap((l) => l.telemetry_gaps ?? [])), // gate lines supply only `gate` (R6): their no_model_call must not leak

  };
  // cold_start_ms is deliberately omitted: graph writes a hard 0 it does not measure (R3a names the gap).
  const withModel = [...base].reverse().find((l) => l.model_requested !== undefined);
  if (withModel?.model_requested !== undefined) ev.model_requested = withModel.model_requested;
  const served = [...base].reverse().find((l) => l.model_served !== undefined);
  if (served?.model_served !== undefined) ev.model_served = served.model_served;
  const llm = sumDefined(base.map((l) => l.llm_calls));
  if (llm !== undefined) ev.llm_calls = llm;
  const tools = sumDefined(base.map((l) => l.tool_calls));
  if (tools !== undefined) ev.tool_calls = tools;

  const tok: Record<string, number | string> = {};
  for (const k of ['input', 'output', 'cache_read', 'cache_write'] as const) {
    const v = sumDefined(base.map((l) => l.tokens?.[k]));
    if (v !== undefined) tok[k] = v;
  }
  const sources = uniq(base.map((l) => l.tokens?.source).filter((s): s is NonNullable<typeof s> => !!s));
  if (sources.length) tok.source = sources.length === 1 ? sources[0] : 'estimated'; // mixed rounds: the weakest claim
  if (Object.keys(tok).length) ev.tokens = tok as StageEvent['tokens'];

  const cost: Record<string, number> = {};
  for (const k of ['tokens', 'compute', 'orchestration'] as const) {
    const v = sumDefined(base.map((l) => l.cost_usd?.[k]));
    if (v !== undefined) cost[k] = v;
  }
  if (Object.keys(cost).length) ev.cost_usd = cost as StageEvent['cost_usd'];

  const outs = base.map((l) => l.output).filter((o): o is NonNullable<GraphLine['output']> => !!o);
  if (outs.length) {
    ev.output = {
      schema_valid: outs.every((o) => o.schema_valid !== false),
      artifact_refs: uniq(outs.flatMap((o) => o.artifact_refs ?? [])),
    };
  }

  // Scoring (expected/correct) is TASK-0014's; they stay unset (optional since spec 006 R6a).
  if (lastGate?.gate) ev.gate = { name: lastGate.gate.name, decision: lastGate.gate.decision };

  const labelled = [...base].reverse().find((l) => l.failure_label);
  if (labelled) {
    ev.failure_label = labelled.failure_label ?? null;
    ev.failure_note = labelled.failure_note ?? null;
  }
  return ev;
}

/** One StageEvent per requested stage that has telemetry, in ladder order. */
export function toStageEvents(lines: GraphLine[], requested: Stage[], opts: MapOptions = {}): StageEvent[] {
  const events: StageEvent[] = [];
  for (const stage of STAGE_ORDER) {
    if (!requested.includes(stage)) continue;
    const mine = lines.filter((l) => l.stage === stage);
    if (mine.length === 0) continue; // run stopped earlier: no record for a stage that never ran
    events.push(mergeStage(stage, mine));
  }
  if (opts.workflowResult === 'stopped-invalid-output' && events.length) {
    const last = events[events.length - 1];
    last.status = 'failed';
    last.failure_label = 'schema';
  }
  return events;
}
