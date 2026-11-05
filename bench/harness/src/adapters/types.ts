// Adapter contract (spec 003 R2). One adapter per contender; the core has no contender-specific logic.
import type { Stage, StageRunRecord, Contender, TicketSet } from '../record.ts';

/** What the core hands an adapter for one run. */
export interface RunContext {
  run_id: string;
  ticket_id: string;
  stages: Stage[];
  rep: number;
  set: TicketSet;
  seed_order: number;
  /** Absolute-or-relative directory `artifacts/<run_id>/`, already created by the core. */
  artifact_dir: string;
}

/** Fields the harness owns; adapters cannot set them (the core overwrites them). */
export type HarnessOwnedFields =
  | 'run_id'
  | 'benchmark_version'
  | 'contender'
  | 'contender_version'
  | 'ticket_id'
  | 'rep'
  | 'set';

/**
 * Raw per-stage output of an adapter. Only `stage` is required; the core fills harness-owned
 * fields and defaults for anything omitted, then validates the whole record before storing.
 */
export type StageEvent = { stage: Stage } & Partial<Omit<StageRunRecord, HarnessOwnedFields | 'stage'>>;

/**
 * A human/operator touch an adapter observed mid-run (R5). The core writes it to the
 * `interventions` table via `store.insertIntervention`; it is not a stage record. Whether a
 * kind counts toward a stage's `interventions` metric is the adapter's call (e.g. G's
 * `scripted_approval` does not, spec 006 R4).
 */
export interface InterventionEvent {
  type: 'intervention';
  stage: Stage;
  at: string;
  kind: string;
  note?: string;
}

/** Everything an adapter may yield: stage events and intervention events. */
export type AdapterEvent = StageEvent | InterventionEvent;

export interface ContenderAdapter {
  /** Contender id recorded on every record (P | N | G | stub). */
  id: Contender;
  version(): Promise<string>;
  run(ctx: RunContext): AsyncIterable<AdapterEvent>;
}
