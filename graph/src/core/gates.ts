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

/**
 * The code gate after plan: every `files` path must exist in its repo's tree or be listed in the
 * same task's `new_files`; a `new_files` path must not already exist. `trees` is keyed by routed
 * repo name; a null tree (checkout unavailable) fails closed. One routed repo means repo-relative
 * paths; several means every path starts with `<repo>/`.
 */
export function planPathGate(
  plan: { tasks: { id: string; files: string[]; new_files?: string[] }[] },
  trees: Record<string, string[] | null>,
): { pass: boolean; reason: string } {
  const repos = Object.keys(trees);
  const single = repos.length === 1;
  const bad: string[] = [];
  const unavailable = new Set<string>();
  const sets = new Map<string, Set<string>>();
  for (const r of repos) {
    const t = trees[r];
    if (t) sets.set(r, new Set(t));
  }
  const resolve = (path: string): { repo: string; rel: string } | null => {
    if (single) return { repo: repos[0]!, rel: path };
    const i = path.indexOf('/');
    const repo = i > 0 ? path.slice(0, i) : '';
    return repos.includes(repo) ? { repo, rel: path.slice(i + 1) } : null;
  };
  for (const task of plan.tasks) {
    const fresh = new Set(task.new_files ?? []);
    for (const path of task.files) {
      if (fresh.has(path)) continue;
      const r = resolve(path);
      if (!r) { bad.push(`${path} (unrouted repo)`); continue; }
      const set = sets.get(r.repo);
      if (!set) { unavailable.add(r.repo); continue; }
      if (!set.has(r.rel)) bad.push(`${path} (not in tree)`);
    }
    for (const path of fresh) {
      const r = resolve(path);
      if (!r) { bad.push(`${path} (unrouted repo)`); continue; }
      const set = sets.get(r.repo);
      if (!set) { unavailable.add(r.repo); continue; }
      if (set.has(r.rel)) bad.push(`${path} (new file already exists)`);
    }
  }
  const parts: string[] = [];
  if (unavailable.size) parts.push(`checkout unavailable for repo(s): ${[...unavailable].join(', ')}`);
  if (bad.length) {
    const shown = bad.slice(0, 10).join(', ');
    parts.push(`${bad.length} path problem(s): ${shown}${bad.length > 10 ? ', ...' : ''}`);
  }
  if (parts.length) return { pass: false, reason: parts.join('; ') };
  return { pass: true, reason: 'all plan paths verified' };
}
