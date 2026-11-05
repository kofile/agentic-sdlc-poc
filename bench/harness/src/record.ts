// Uniform stage-run record, per notes/02-benchmark-spec.md section 7, field for field.
// `stub` is the only addition to the contender enum (spec 003 R3). `telemetry_gaps` is
// mandatory: no default, so a record that omits it is rejected rather than shown as zeros.
import { z } from 'zod';

export const STAGE_ORDER = ['triage', 'route', 'design', 'plan', 'execute', 'open_pr', 'validate', 'review'] as const;
export type Stage = (typeof STAGE_ORDER)[number];
export const StageSchema = z.enum(STAGE_ORDER);

export const CONTENDERS = ['P', 'N', 'G', 'stub'] as const;
export type Contender = (typeof CONTENDERS)[number];
export const ContenderSchema = z.enum(CONTENDERS);

export const TicketSetSchema = z.enum(['dev', 'heldout']);
export type TicketSet = z.infer<typeof TicketSetSchema>;

export const StageRunRecordSchema = z
  .object({
    run_id: z.string().min(1),
    benchmark_version: z.string(),
    contender: ContenderSchema,
    contender_version: z.string(),
    ticket_id: z.string().min(1),
    ticket_class: z.string(),
    rep: z.number().int().nonnegative(),
    set: TicketSetSchema,
    repo: z.string(),
    base_sha: z.string(),
    stage: StageSchema,
    started_at: z.string(),
    ended_at: z.string(),
    wall_ms: z.number().nonnegative(),
    active_ms: z.number().nonnegative(),
    waiting_ms: z.number().nonnegative(),
    cold_start_ms: z.number().nonnegative(),
    model_requested: z.string(),
    model_served: z.string(),
    llm_calls: z.number().int().nonnegative(),
    tool_calls: z.number().int().nonnegative(),
    tokens: z.object({
      input: z.number().nonnegative(),
      output: z.number().nonnegative(),
      cache_read: z.number().nonnegative(),
      cache_write: z.number().nonnegative(),
      source: z.enum(['reported', 'estimated', 'provider_log']),
    }),
    cost_usd: z.object({
      tokens: z.number().nonnegative(),
      compute: z.number().nonnegative(),
      orchestration: z.number().nonnegative(),
    }),
    status: z.enum(['completed', 'failed', 'stopped_by_gate', 'budget', 'infra']),
    gate: z
      .object({
        name: z.string(),
        decision: z.enum(['pass', 'fail']),
        expected: z.enum(['pass', 'fail']).optional(),
        correct: z.boolean().optional(),
      })
      .nullable(),
    output: z.object({
      schema_valid: z.boolean(),
      artifact_refs: z.array(z.string()),
    }),
    fix_attempts: z.number().int().nonnegative(),
    infra_retries: z.number().int().nonnegative(),
    interventions: z.number().int().nonnegative(),
    assisted: z.boolean(),
    failure_label: z.string().nullable(),
    failure_note: z.string().nullable(),
    scores: z.object({
      hidden_tests_passed: z.number().int().nonnegative(),
      hidden_tests_total: z.number().int().nonnegative(),
      gates_green: z.boolean(),
      rubric: z.unknown().nullable(),
    }),
    telemetry_gaps: z.array(z.string()),
    canary_leak: z.boolean(),
  })
  .strict();
export type StageRunRecord = z.infer<typeof StageRunRecordSchema>;

/** Parse a `<from>..<to>` stage range (inclusive). Accepts `open-pr` as an alias of `open_pr`. */
export function parseStageRange(range: string): Stage[] {
  const parts = range.split('..');
  if (parts.length !== 2) throw new Error(`malformed stage range "${range}" (expected <from>..<to>)`);
  const norm = (s: string): string => s.trim().replace(/-/g, '_');
  const from = STAGE_ORDER.indexOf(norm(parts[0]) as Stage);
  const to = STAGE_ORDER.indexOf(norm(parts[1]) as Stage);
  if (from < 0) throw new Error(`unknown stage "${parts[0]}" in range "${range}"`);
  if (to < 0) throw new Error(`unknown stage "${parts[1]}" in range "${range}"`);
  if (from > to) throw new Error(`stage range "${range}" is backwards`);
  return STAGE_ORDER.slice(from, to + 1) as Stage[];
}
