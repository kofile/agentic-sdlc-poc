// Scripted gate approver (spec 006 R3/R4). Polls the workflow's `state` query; each time it
// reports `waiting: { gate, round }` that has not been answered yet, signals `decide` with an
// approval and returns an intervention event plus the waited ms. Pure of Temporal: works on any
// handle with `query`/`signal`, so it is unit-tested with a fake.
import { STAGE_ORDER, type Stage } from '../../record.ts';
import type { InterventionEvent } from '../types.ts';

export interface GateHandle {
  query(name: string): Promise<unknown>;
  signal(name: string, arg: unknown): Promise<void>;
}

export interface GateDriverState {
  answered: Set<string>;
  /** Waited ms per stage, summed over approvals (feeds `waiting_ms`). */
  waitedMs: Map<Stage, number>;
}

export interface GateApproval {
  event: InterventionEvent;
  stage: Stage;
  waited_ms: number;
}

export function newGateState(): GateDriverState {
  return { answered: new Set(), waitedMs: new Map() };
}

/** Gate name to the stage it pauses (graph gates are named after their stage). */
export function gateStage(gate: string): Stage {
  if ((STAGE_ORDER as readonly string[]).includes(gate)) return gate as Stage;
  throw new Error(`G: unknown gate "${gate}" has no stage mapping`);
}

export interface PollOptions {
  team: string;
  now?: () => number;
}

/** One poll. Returns the approval it made, or null when nothing was waiting (or already answered). */
export async function pollGates(handle: GateHandle, st: GateDriverState, opts: PollOptions): Promise<GateApproval | null> {
  const now = opts.now ?? Date.now;
  const seen = now();
  const s = (await handle.query('state')) as { waiting?: { gate: string; round: number } | null } | null;
  const w = s?.waiting;
  if (!w) return null;
  const key = `${w.gate}#${w.round}`;
  if (st.answered.has(key)) return null;
  st.answered.add(key);
  const stage = gateStage(w.gate);
  await handle.signal('decide', { gate: w.gate, round: w.round, approved: true, by: 'bench-scripted' });
  const waited_ms = Math.max(0, now() - seen);
  st.waitedMs.set(stage, (st.waitedMs.get(stage) ?? 0) + waited_ms);
  return {
    stage,
    waited_ms,
    event: { type: 'intervention', stage, at: new Date(now()).toISOString(), kind: 'scripted_approval', note: `${key} team=${opts.team}` },
  };
}
