// Gate policy as data. A team's JSON file (teams/*.json) picks human-vs-automatic per gate and
// per-gate timeout/escalation behaviour. A run snapshots its policy at start (loaded through an
// activity: workflow sandbox forbids file reads, per spike-02 footgun #1).
import { z } from 'zod';

export const GateDecisionModeSchema = z.enum(['human', 'auto']);
export const TimeoutActionSchema = z.enum(['auto-reject', 'escalate']);

export const GatePolicySchema = z.object({
  team: z.string(),
  gates: z.record(z.string(), GateDecisionModeSchema),
  humanTimeoutSec: z.number().int().positive(),
  onTimeout: TimeoutActionSchema.default('auto-reject'),
  maxRejectRounds: z.number().int().positive().default(3),
});
export type GatePolicy = z.infer<typeof GatePolicySchema>;

export const GateNameSchema = z.enum(['triage', 'route', 'design', 'merge']);
export type GateName = z.infer<typeof GateNameSchema>;

/** The code gate after triage: A/B pass, C/D stop with reason. Never delegated to the LLM (C5). */
export function triageGate(grade: 'A' | 'B' | 'C' | 'D'): { pass: boolean; reason: string } {
  if (grade === 'A' || grade === 'B') return { pass: true, reason: `grade ${grade}` };
  return { pass: false, reason: `grade ${grade}: below pipeline-readiness threshold` };
}

/** The code gate after route: at least one repo, every repo named in `order`. */
export function routeGate(route: { repos: { name: string }[]; order: string[] }): { pass: boolean; reason: string } {
  if (route.repos.length === 0) return { pass: false, reason: 'no repository identified' };
  const names = new Set(route.repos.map((r) => r.name));
  const missing = route.order.filter((o) => !names.has(o));
  if (missing.length) return { pass: false, reason: `order references unrouted repo(s): ${missing.join(', ')}` };
  return { pass: true, reason: `${route.repos.length} repo(s) routed` };
}

export type Decision = { gate: string; round: number; approved: boolean; feedback?: string; by?: 'human' | 'auto' | 'timer'; approvedBy?: string };

/** Pure function: given policy + gate name, is this gate human or automatic? */
export function modeFor(policy: GatePolicy, gate: string): 'human' | 'auto' {
  return policy.gates[gate] === 'human' ? 'human' : 'auto';
}
