// Deterministic stub adapter: no network, fixed telemetry. Used by tests and `bench run --contender stub`.
import fs from 'node:fs';
import path from 'node:path';
import type { ContenderAdapter, RunContext, StageEvent } from './types.ts';

export const STUB_TELEMETRY_GAPS = ['tokens_not_measured', 'cost_not_measured', 'model_not_called', 'timings_synthetic'];

export const stubAdapter: ContenderAdapter = {
  id: 'stub',
  async version() {
    return 'stub-1';
  },
  async *run(ctx: RunContext): AsyncGenerator<StageEvent> {
    fs.mkdirSync(ctx.artifact_dir, { recursive: true });
    const file = path.join(ctx.artifact_dir, 'stub.txt');
    fs.writeFileSync(file, `stub run ${ctx.run_id}\nstages: ${ctx.stages.join(',')}\n`);
    for (const stage of ctx.stages) {
      yield {
        stage,
        ticket_class: 'stub',
        started_at: '2026-01-01T00:00:00.000Z',
        ended_at: '2026-01-01T00:00:01.000Z',
        wall_ms: 1000,
        active_ms: 800,
        waiting_ms: 200,
        cold_start_ms: 0,
        model_requested: 'stub',
        model_served: 'stub',
        llm_calls: 0,
        tool_calls: 0,
        tokens: { input: 100, output: 50, cache_read: 0, cache_write: 0, source: 'estimated' },
        cost_usd: { tokens: 0, compute: 0, orchestration: 0 },
        status: 'completed',
        output: { schema_valid: true, artifact_refs: [file] },
        telemetry_gaps: [...STUB_TELEMETRY_GAPS],
      };
    }
  },
};
