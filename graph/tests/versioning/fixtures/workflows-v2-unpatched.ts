// TEST FIXTURE (TASK-0027): workflow v2 WITHOUT guard (negative control only). Copy of src/workflow/workflows.ts `pipeline`
// with one inserted step. Everything else is re-exported from the real module.
import { proxyActivities, setHandler, condition, patched } from '@temporalio/workflow';
import type * as A from '../../../src/workflow/activities.ts';
import { triageGate, routeGate } from '../../../src/core/gates.ts';
import { decide, getState } from '../../../src/workflow/workflows.ts';
import type { Decision, PipelineState, PipelineInput, PipelineResult } from '../../../src/workflow/workflows.ts';
export { decide, getState } from '../../../src/workflow/workflows.ts';
export type { Decision, PipelineState, PipelineInput, PipelineResult } from '../../../src/workflow/workflows.ts';

// The activity v1 never calls. Declared here because src/ must not change.
type Precheck = { precheck(runId: string, ticket: unknown): Promise<void> };
const std = proxyActivities<typeof A & Precheck>({ startToCloseTimeout: '30s', retry: { maximumAttempts: 1 } });
// Model-backed stages: retry with backoff is config on the activity options, not code (spike-02 G1).
const model = proxyActivities<typeof A>({
  startToCloseTimeout: '30s',
  retry: { initialInterval: '1s', backoffCoefficient: 2, maximumInterval: '10s', maximumAttempts: 5 },
});
// The one agentic stage: heartbeat-monitored so a killed worker is detected in
// ~heartbeatTimeout, not startToCloseTimeout (spike-02 A1).
const long = proxyActivities<typeof A>({
  startToCloseTimeout: '180s', heartbeatTimeout: '5s',
  retry: { initialInterval: '500ms', maximumAttempts: 3 },
});


export async function pipeline(inp: PipelineInput): Promise<PipelineResult> {
  const { runId, ticket, team } = inp;
  const log: string[] = [];
  // Gate keying: `${gate}#${round}` => first decision wins; duplicate/stale ones are dropped
  // and logged (spike-02 B: this keying is what made duplicate/concurrent approvals safe).
  const decisions = new Map<string, Decision>();
  const ignored: Decision[] = [];
  let waiting: { gate: string; round: number } | null = null;
  let step = 'init';

  setHandler(getState, () => ({ step, waiting, log, ignoredDuplicates: ignored.length }));
  setHandler(decide, (d) => {
    const k = `${d.gate}#${d.round}`;
    if (!waiting || waiting.gate !== d.gate || waiting.round !== d.round || decisions.has(k)) {
      ignored.push(d);
      log.push(`gate:${d.gate}:round${d.round}:ignored-duplicate-or-stale`);
      return;
    }
    decisions.set(k, d);
  });

  // GATE POLICY AS DATA: read once via an activity (workflow sandbox forbids file reads) =>
  // recorded in history => replay-safe; a mid-run edit to teams/<team>.json does not
  // retroactively change a running workflow (spike-02 E).
  const policy = await std.loadPolicy(team);

  async function gate(name: string, round: number): Promise<Decision> {
    if (policy.gates[name] !== 'human') {
      log.push(`gate:${name}:auto`);
      return { gate: name, round, approved: true, by: 'auto' };
    }
    waiting = { gate: name, round };
    step = `waiting:${name}`;
    const k = `${name}#${round}`;
    // Durable timer + signal wait: survives worker death/restart for as long as the timer says
    // (spike-02 C2).
    const got = await condition(() => decisions.has(k), `${policy.humanTimeoutSec * 1000}ms`);
    waiting = null;
    if (!got) {
      log.push(`gate:${name}:timeout:${policy.onTimeout}`);
      return { gate: name, round, approved: policy.onTimeout === 'escalate' ? false : false, feedback: policy.onTimeout, by: 'timer' };
    }
    const d = decisions.get(k)!;
    log.push(`gate:${name}:${d.approved ? 'approved' : 'rejected'}`);
    return d;
  }

  step = 'triage';
  const tri = await model.triage(runId, ticket);
  const tGate = triageGate(tri.output.grade);
  await std.recordGateOutcome(runId, ticket.id, 'triage', 'A or B?', tGate.pass ? 'pass' : 'fail', tGate.reason);
  if (!tGate.pass) {
    await std.transitionTicket(runId, ticket.id, 'Waiting for Info');
    return { status: 'stopped-at-triage', grade: tri.output.grade, reason: tGate.reason, log };
  }

  step = 'route';
  const rt = await model.route(runId, ticket);
  const rGate = routeGate(rt.output);
  await std.recordGateOutcome(runId, ticket.id, 'route', 'Repo identified?', rGate.pass ? 'pass' : 'fail', rGate.reason);
  if (!rGate.pass) {
    await std.transitionTicket(runId, ticket.id, 'Waiting for Info');
    return { status: 'stopped-at-route', reason: rGate.reason, log };
  }

  // Mirrors the real workflow (spec 010): the in-flight run already took this patched path on v1.
  const preload = patched('context-preload-v1');
  // v2 change: a new activity call inserted BEFORE the design loop, i.e. before the point
  // where the in-flight run (parked at the design gate) resumes.
  step = 'precheck';
  await std.precheck(runId, ticket);


  // Reject-and-redo loop is just a bounded while loop (spike-02 D).
  let feedback: string | null = null;
  let round = 1;
  let designOut: Awaited<ReturnType<typeof model.design>>['output'] | undefined;
  for (;;) {
    step = `design:r${round}`;
    const d = await (preload ? model.design(runId, ticket, feedback, round, rt.output.order) : model.design(runId, ticket, feedback, round));
    designOut = d.output;
    const decision = await gate('design', round);
    if (decision.approved) break;
    if (decision.by === 'timer' && policy.onTimeout === 'escalate') {
      await std.commentTicket(runId, ticket.id, `Design gate escalated: no response within ${policy.humanTimeoutSec}s`);
      return { status: 'escalated-timeout', at: 'design', round, log };
    }
    if (round >= policy.maxRejectRounds) {
      return { status: 'rejected-max-rounds', at: 'design', log };
    }
    feedback = decision.feedback ?? 'rejected';
    round++;
  }

  step = 'plan';
  const pl = await (preload ? model.plan(runId, ticket, designOut!, rt.output.order) : model.plan(runId, ticket, designOut!));
  if (preload) {
    const pathGate = pl.pathGate;
    await std.recordGateOutcome(runId, ticket.id, 'plan', 'Plan paths exist?', pathGate.pass ? 'pass' : 'fail', pathGate.reason);
    if (!pathGate.pass) {
      await std.transitionTicket(runId, ticket.id, 'Waiting for Info');
      return { status: 'stopped-at-plan-paths', reason: pathGate.reason, log };
    }
  }
  const pg = await gate('plan', 1);
  if (!pg.approved) {
    if (pg.by === 'timer' && policy.onTimeout === 'escalate') return { status: 'escalated-timeout', at: 'plan', round: 1, log };
    return { status: 'rejected', at: 'plan', log };
  }

  step = 'execute';
  const execResult = await long.execute(runId, ticket, pl.output, { budgetSeconds: inp.budgetSeconds });

  step = 'open-pr';
  const pr = await std.openPr(runId, ticket, execResult);
  await std.commentTicket(runId, ticket.id, `PR opened: ${pr.url}`);
  await std.transitionTicket(runId, ticket.id, 'Ready for PR');
  step = 'done';
  return { status: 'opened-pr', pr, designRounds: round, log };
}
