// One JSON record per stage per run, per notes/02-benchmark-spec.md section 7 ("uniform
// stage-run record schema"), contender fixed to 'G' (the graph system). Appended to a JSONL
// file so a benchmark harness can ingest it without touching this process's memory.
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

export const StageRunRecordSchema = z.object({
  run_id: z.string(),
  benchmark_version: z.string().default('v0.1'),
  contender: z.literal('G'),
  contender_version: z.string(),
  ticket_id: z.string(),
  stage: z.enum(['triage', 'route', 'design', 'plan', 'execute', 'open_pr']),
  started_at: z.string(),
  ended_at: z.string(),
  wall_ms: z.number(),
  active_ms: z.number(),
  waiting_ms: z.number(),
  cold_start_ms: z.number().default(0),
  model_requested: z.string().optional(),
  model_served: z.string().optional(),
  llm_calls: z.number().default(0),
  tool_calls: z.number().default(0),
  tokens: z.object({
    input: z.number().default(0),
    output: z.number().default(0),
    cache_read: z.number().default(0),
    cache_write: z.number().default(0),
    source: z.enum(['reported', 'estimated', 'provider_log']).default('estimated'),
  }),
  cost_usd: z.object({ tokens: z.number().default(0), compute: z.number().default(0), orchestration: z.number().default(0) }),
  status: z.enum(['completed', 'failed', 'stopped_by_gate', 'budget', 'infra']),
  gate: z.object({ name: z.string(), decision: z.enum(['pass', 'fail']), expected: z.enum(['pass', 'fail']).optional(), correct: z.boolean().optional() }).nullable().default(null),
  output: z.object({ schema_valid: z.boolean(), artifact_refs: z.array(z.string()).default([]) }),
  fix_attempts: z.number().default(0),
  infra_retries: z.number().default(0),
  interventions: z.number().default(0),
  assisted: z.boolean().default(false),
  failure_label: z.string().nullable().default(null),
  failure_note: z.string().nullable().default(null),
  scores: z.object({ hidden_tests_passed: z.number().default(0), hidden_tests_total: z.number().default(0), gates_green: z.boolean().default(true), rubric: z.unknown().nullable().default(null) }).default({ hidden_tests_passed: 0, hidden_tests_total: 0, gates_green: true, rubric: null }),
  telemetry_gaps: z.array(z.string()).default([]),
  canary_leak: z.boolean().default(false),
});
export type StageRunRecord = z.infer<typeof StageRunRecordSchema>;

export function appendTelemetry(filePath: string, record: StageRunRecord): void {
  const parsed = StageRunRecordSchema.parse(record);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(parsed) + '\n');
}

export interface PriceEntry { input_per_1k: number; output_per_1k: number; cache_read_per_1k: number; cache_write_per_1k: number }
export type PriceTable = Record<string, PriceEntry>;

export interface TokenCounts { input: number; output: number; cache_read: number; cache_write: number }

/** Cost over all four token kinds. `priceKey` says which table entry priced it: the model
 * itself, `'default'` (a fallback the caller should flag), or null when nothing matched. */
export function estimateCostUsd(prices: PriceTable, model: string, tokens: TokenCounts): { usd: number; priceKey: string | null } {
  const exact = prices[model];
  const p = exact ?? prices['default'];
  if (!p) return { usd: 0, priceKey: null };
  const usd = ((tokens.input / 1000) * p.input_per_1k)
    + ((tokens.output / 1000) * p.output_per_1k)
    + ((tokens.cache_read / 1000) * p.cache_read_per_1k)
    + ((tokens.cache_write / 1000) * p.cache_write_per_1k);
  return { usd: +usd.toFixed(6), priceKey: exact ? model : 'default' };
}
