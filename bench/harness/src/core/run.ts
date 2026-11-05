// Orchestrates one run: create run row -> iterate adapter events -> normalise -> validate -> store.
// No contender-specific logic here; adapters own that.
import fs from 'node:fs';
import path from 'node:path';
import type { ContenderAdapter, RunContext, StageEvent } from '../adapters/types.ts';
import type { Stage, StageRunRecord, TicketSet } from '../record.ts';
import { makeRunId } from '../run-id.ts';
import type { Store } from '../store.ts';

export const BENCHMARK_VERSION = 'v0.1';

export interface RunOptions {
  store: Store;
  adapter: ContenderAdapter;
  ticket: string;
  rep: number;
  stages: Stage[];
  seedOrder: number;
  set?: TicketSet;
  artifactsRoot: string;
  now?: () => Date;
}

export interface RunResult {
  run_id: string;
  status: 'completed' | 'failed';
  stored: number;
  error?: string;
}

function describe(e: unknown): string {
  if (e && typeof e === 'object' && 'issues' in e && Array.isArray((e as { issues: unknown[] }).issues)) {
    const issues = (e as { issues: { path: (string | number)[]; message: string }[] }).issues;
    return `invalid stage record: ${issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`;
  }
  return e instanceof Error ? e.message : String(e);
}

/** Fill harness-owned fields and defaults the adapter did not give. */
export function normalise(
  ev: StageEvent,
  base: { run_id: string; contender: StageRunRecord['contender']; contender_version: string; ticket: string; rep: number; set: TicketSet },
  nowIso: string,
): Record<string, unknown> {
  return {
    ticket_class: '',
    repo: '',
    base_sha: '',
    started_at: nowIso,
    ended_at: nowIso,
    wall_ms: 0,
    active_ms: 0,
    waiting_ms: 0,
    cold_start_ms: 0,
    model_requested: '',
    model_served: '',
    llm_calls: 0,
    tool_calls: 0,
    tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0, source: 'estimated' },
    cost_usd: { tokens: 0, compute: 0, orchestration: 0 },
    status: 'completed',
    gate: null,
    output: { schema_valid: true, artifact_refs: [] },
    fix_attempts: 0,
    infra_retries: 0,
    interventions: 0,
    assisted: false,
    failure_label: null,
    failure_note: null,
    scores: { hidden_tests_passed: 0, hidden_tests_total: 0, gates_green: false, rubric: null },
    telemetry_gaps: [],
    canary_leak: false,
    ...ev,
    // harness-owned: always last so adapters cannot override them
    run_id: base.run_id,
    benchmark_version: BENCHMARK_VERSION,
    contender: base.contender,
    contender_version: base.contender_version,
    ticket_id: base.ticket,
    rep: base.rep,
    set: base.set,
  };
}

export async function executeRun(opts: RunOptions): Promise<RunResult> {
  const { store, adapter, ticket, rep, stages, seedOrder } = opts;
  const set = opts.set ?? 'dev';
  const now = opts.now ?? (() => new Date());
  const startedAt = now();
  const run_id = makeRunId(startedAt, adapter.id, ticket, rep);
  const artifact_dir = path.join(opts.artifactsRoot, run_id);
  fs.mkdirSync(artifact_dir, { recursive: true });
  const contender_version = await adapter.version();

  store.insertRun({
    run_id,
    contender: adapter.id,
    contender_version,
    ticket_id: ticket,
    rep,
    set_name: set,
    stages: stages.join(','),
    seed_order: seedOrder,
    started_at: startedAt.toISOString(),
    ended_at: null,
    status: 'running',
    artifact_dir,
  });

  const ctx: RunContext = { run_id, ticket_id: ticket, stages, rep, set, seed_order: seedOrder, artifact_dir };
  const base = { run_id, contender: adapter.id, contender_version, ticket, rep, set };
  let stored = 0;
  try {
    for await (const ev of adapter.run(ctx)) {
      store.insertStageRun(normalise(ev, base, now().toISOString()));
      stored++;
    }
  } catch (e) {
    const error = describe(e);
    store.finishRun(run_id, 'failed', now().toISOString());
    return { run_id, status: 'failed', stored, error };
  }
  store.finishRun(run_id, 'completed', now().toISOString());
  return { run_id, status: 'completed', stored };
}
