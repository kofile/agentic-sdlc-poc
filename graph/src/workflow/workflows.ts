// The graph. Stage ladder per sdlc-pipeline-plugin/skills/pipeline-conventions/SKILL.md:
// triage -> route -> design -> [human gate] -> plan -> [human gate] -> execute -> open-pr.
// Pattern (gate keying, condition()+timer, reject-redo as a loop) follows spike-02's proven
// design; see notes/spike-02-engine.md section "Evidence" (B, C, D).
import { proxyActivities, defineSignal, defineQuery, setHandler, condition, ActivityFailure, ApplicationFailure } from '@temporalio/workflow';
import type * as A from './activities.ts';
import { triageGate, routeGate } from '../core/gates.ts';
import type { Ticket } from '../core/schemas.ts';

const std = proxyActivities<typeof A>({ startToCloseTimeout: '30s', retry: { maximumAttempts: 1 } });
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

export type Decision = { gate: string; round: number; approved: boolean; feedback?: string; by?: string };
export const decide = defineSignal<[Decision]>('decide');
export const getState = defineQuery<PipelineState>('state');

export interface PipelineState {
  step: string;
  waiting: { gate: string; round: number } | null;
  log: string[];
  ignoredDuplicates: number;
}

export interface PipelineInput {
  runId: string;
  ticket: Ticket;
  team: string;
  budgetSeconds?: number;
}

export type PipelineResult =
  | { status: 'stopped-at-triage'; grade: string; reason: string; log: string[] }
  | { status: 'stopped-at-route'; reason: string; log: string[] }
  | { status: 'stopped-invalid-output'; at: string; reason: string; log: string[] }
  | { status: 'escalated-timeout'; at: string; round: number; log: string[] }
  | { status: 'rejected'; at: string; log: string[] }
  | { status: 'rejected-max-rounds'; at: string; log: string[] }
  | { status: 'opened-pr'; pr: { number: number; url: string }; designRounds: number; log: string[] };

class InvalidOutputStop extends Error {
  constructor(public readonly stage: string, public readonly reason: string) { super(reason); }
}

/** Runs a model-backed stage; a non-retryable ReasoningOutputInvalid becomes InvalidOutputStop
 * (fail closed). Anything else propagates unchanged. */
async function modelStage<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ActivityFailure && err.cause instanceof ApplicationFailure && err.cause.type === 'ReasoningOutputInvalid') {
      throw new InvalidOutputStop(stage, err.cause.message);
    }
    throw err;
  }
}

export async function pipeline(inp: PipelineInput): Promise<PipelineResult> {
  const { runId, ticket } = inp;
  const log: string[] = [];
  try {
    return await runPipeline(inp, log);
  } catch (err) {
    if (err instanceof InvalidOutputStop) {
      await std.recordGateOutcome(runId, ticket.id, err.stage as 'triage' | 'route' | 'design' | 'plan', 'Output valid?', 'fail', err.reason);
      await std.transitionTicket(runId, ticket.id, 'Waiting for Info');
      return { status: 'stopped-invalid-output', at: err.stage, reason: err.reason, log };
    }
    throw err;
  }
}

async function runPipeline(inp: PipelineInput, log: string[]): Promise<PipelineResult> {
  const { runId, ticket, team } = inp;
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
  const tri = await modelStage('triage', () => model.triage(runId, ticket));
  const tGate = triageGate(tri.output.grade);
  await std.recordGateOutcome(runId, ticket.id, 'triage', 'A or B?', tGate.pass ? 'pass' : 'fail', tGate.reason);
  if (!tGate.pass) {
    await std.transitionTicket(runId, ticket.id, 'Waiting for Info');
    return { status: 'stopped-at-triage', grade: tri.output.grade, reason: tGate.reason, log };
  }

  step = 'route';
  const rt = await modelStage('route', () => model.route(runId, ticket));
  const rGate = routeGate(rt.output);
  await std.recordGateOutcome(runId, ticket.id, 'route', 'Repo identified?', rGate.pass ? 'pass' : 'fail', rGate.reason);
  if (!rGate.pass) {
    await std.transitionTicket(runId, ticket.id, 'Waiting for Info');
    return { status: 'stopped-at-route', reason: rGate.reason, log };
  }

  // Reject-and-redo loop is just a bounded while loop (spike-02 D).
  let feedback: string | null = null;
  let round = 1;
  let designOut: Awaited<ReturnType<typeof model.design>>['output'] | undefined;
  for (;;) {
    step = `design:r${round}`;
    const d = await modelStage('design', () => model.design(runId, ticket, feedback, round));
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
  const pl = await modelStage('plan', () => model.plan(runId, ticket, designOut!));
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
