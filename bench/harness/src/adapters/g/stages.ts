// Stage-range validation for G (spec 006 R1). Returns a one-line error, or null when valid.
import { STAGE_ORDER, type Stage } from '../../record.ts';

const LAST_SUPPORTED: Stage = 'open_pr';

export function validateGStages(stages: Stage[]): string | null {
  if (stages.length === 0) return 'G: no stages requested';
  if (stages[0] !== 'triage') return `G has no entry point mid-ladder: --stages must start at triage (got ${stages[0]})`;
  const maxIdx = STAGE_ORDER.indexOf(LAST_SUPPORTED);
  for (const s of stages) {
    if (STAGE_ORDER.indexOf(s) > maxIdx) return `G does not support stage ${s} yet: supported ends are triage through ${LAST_SUPPORTED}`;
  }
  return null;
}
