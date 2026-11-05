import { proxyActivities, defineSignal, defineQuery, setHandler, condition } from '@temporalio/workflow';
import type * as A from './activities.ts';

const std = proxyActivities<typeof A>({ startToCloseTimeout: '30s', retry: { maximumAttempts: 1 } });
// retry with backoff = config on the activity options, not code:
const model = proxyActivities<typeof A>({
  startToCloseTimeout: '30s',
  retry: { initialInterval: '1s', backoffCoefficient: 2, maximumInterval: '10s', maximumAttempts: 5 },
});
const long = proxyActivities<typeof A>({
  startToCloseTimeout: '120s', heartbeatTimeout: '3s',
  retry: { initialInterval: '500ms', maximumAttempts: 5 },
});

export type Decision = { gate: string; round: number; approved: boolean; feedback?: string; by?: string };
export const decide = defineSignal<[Decision]>('decide');
export const getState = defineQuery<any>('state');

export type Input = { runId: string; ticket: { id: string; grade?: string }; team: string; knobs?: any; guard?: boolean };

export async function pipeline(inp: Input) {
  const { runId, ticket, knobs = {}, guard = false } = inp;
  const log: string[] = [];
  const decisions = new Map<string, Decision>(); // keyed gate#round => first decision wins, later ones dropped
  const ignored: Decision[] = [];
  let waiting: { gate: string; round: number } | null = null;
  let step = 'init';
  setHandler(getState, () => ({ step, waiting, log, ignoredDuplicates: ignored.length }));
  setHandler(decide, (d) => {
    const k = `${d.gate}#${d.round}`;
    if (!waiting || waiting.gate !== d.gate || waiting.round !== d.round || decisions.has(k)) { ignored.push(d); return; }
    decisions.set(k, d);
  });

  // GATE POLICY AS DATA: read once via an activity => recorded in history => replay-safe, and a mid-run config edit
  // does not retroactively change a running workflow.
  const policy = await std.loadPolicy(inp.team);

  async function gate(name: string, round: number): Promise<Decision> {
    if (policy.gates[name] !== 'human') { log.push(`gate:${name}:auto`); return { gate: name, round, approved: true, by: 'auto' }; }
    waiting = { gate: name, round }; step = `waiting:${name}`;
    const k = `${name}#${round}`;
    // durable timer + signal wait: survives worker death/restart for as long as the timer says
    const got = await condition(() => decisions.has(k), `${policy.humanTimeoutSec * 1000}ms`);
    waiting = null;
    if (!got) { log.push(`gate:${name}:timeout`); return { gate: name, round, approved: false, feedback: 'timeout', by: 'timer' }; }
    const d = decisions.get(k)!; log.push(`gate:${name}:${d.approved ? 'approved' : 'rejected'}`); return d;
  }

  step = 'triage';
  const tri = await std.triage(runId, ticket);
  if (!(tri.grade === 'A' || tri.grade === 'B')) return { status: 'stopped-at-triage', grade: tri.grade, log }; // CODE gate
  step = 'route'; await std.route(runId, ticket);

  // reject-and-redo loop is just a while loop
  let feedback: string | null = null, round = 1, design: any;
  for (;;) {
    step = `design:r${round}`;
    design = await model.design(runId, ticket, feedback, round, knobs);
    const d = await gate('design', round);
    if (d.approved) break;
    if (d.by === 'timer') return { status: 'escalated-timeout', at: 'design', round, log };
    feedback = d.feedback ?? 'rejected'; round++;
  }
  step = 'plan'; const plan = await std.plan(runId, design);
  const pg = await gate('plan', 1);
  if (!pg.approved) return { status: pg.by === 'timer' ? 'escalated-timeout' : 'rejected', at: 'plan', log };
  step = 'execute'; await long.execute(runId, knobs, guard);
  step = 'open-pr'; const pr = await std.openPr(runId, guard);
  const mg = await gate('merge', 1);
  if (!mg.approved) return { status: mg.by === 'timer' ? 'escalated-timeout' : 'rejected', at: 'merge', pr, log };
  await std.merge(runId, guard);
  step = 'done';
  return { status: 'merged', pr, designRounds: round, log };
}
