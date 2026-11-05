import { Annotation, StateGraph, START, END, interrupt, Command } from '@langchain/langgraph';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import * as S from '../common/stubs.ts';

const last = <T>(d?: T) => Annotation<T>({ reducer: (_a, b) => b, default: () => d as any });
const State = Annotation.Root({
  runId: last<string>(), ticket: last<any>(), team: last<string>(), knobs: last<any>({}), guard: last<boolean>(false),
  policy: last<S.Policy | null>(null), grade: last<string>(), designDoc: last<any>(), feedback: last<string | null>(null),
  round: last<number>(1), deadline: last<number>(0), decision: last<any>(null), status: last<string>('running'),
  log: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});
type St = typeof State.State;

export function checkpointer() {
  const dir = process.env.DATA_DIR!; mkdirSync(dir, { recursive: true });
  return SqliteSaver.fromConnString(join(dir, 'checkpoints.sqlite'));
}

export function build(opts: { naive?: boolean } = {}) {
  // gate = two nodes: ARM (pure, stores deadline in state) then WAIT (interrupt). interrupt() re-runs its node from the top on
  // resume, so anything before it must be idempotent; putting the deadline in its own node is what keeps it stable.
  const gate = (name: string) => ({
    arm: async (s: St) => (s.policy!.gates[name] === 'human'
      ? { deadline: Date.now() + s.policy!.humanTimeoutSec * 1000, decision: null }
      : { decision: { approved: true, by: 'auto' }, log: [`gate:${name}:auto`] }),
    wait: async (s: St) => {
      if (s.decision) return {};                      // auto gate: nothing to wait for
      const d = interrupt({ gate: name, round: s.round, deadline: s.deadline });   // pauses; resume value comes back here
      return { decision: d, log: [`gate:${name}:${d.approved ? 'approved' : 'rejected'}${d.by === 'timer' ? '(timeout)' : ''}`] };
    },
  });
  const gd = gate('design'), gp = gate('plan'), gm = gate('merge');

  const g = new StateGraph(State)
    .addNode('loadPolicy', async (s) => ({ policy: S.loadPolicyFile(s.team) }))          // policy snapshot lives in state
    .addNode('triage', async (s) => ({ grade: (await S.triageStub(s.runId, s.ticket)).grade }))
    .addNode('route', async (s) => { await S.routeStub(s.runId, s.ticket); return {}; })
    .addNode('design', async (s) => {
      const design = await S.designStub(s.runId, s.ticket, s.feedback, s.round, s.knobs);
      if (opts.naive && s.policy!.gates.design === 'human') { // FOOTGUN variant: model call and interrupt in the SAME node
        const d = interrupt({ gate: 'design', round: s.round });
        return { designDoc: design, decision: d };
      }
      return { designDoc: design };
    }, { retryPolicy: { maxAttempts: 5, initialInterval: 1000, backoffFactor: 2, maxInterval: 10000, jitter: false } })
    .addNode('designArm', opts.naive ? async (_s: St) => ({}) : gd.arm).addNode('designWait', opts.naive ? async (s: St) => ({}) : gd.wait)
    .addNode('designReject', async (s) => ({ feedback: s.decision.feedback ?? 'rejected', round: s.round + 1 }))
    .addNode('plan', async (s) => { await S.planStub(s.runId, s.designDoc); return {}; })
    .addNode('planArm', gp.arm).addNode('planWait', gp.wait)
    .addNode('execute', async (s) => { await S.executeStub(s.runId, s.knobs, s.guard); return {}; })
    .addNode('openPr', async (s) => { await S.openPrStub(s.runId, s.guard); return {}; })
    .addNode('mergeArm', gm.arm).addNode('mergeWait', gm.wait)
    .addNode('merge', async (s) => { await S.mergeStub(s.runId, s.guard); return { status: 'merged' }; })
    .addEdge(START, 'loadPolicy').addEdge('loadPolicy', 'triage')
    .addConditionalEdges('triage', (s) => (s.grade === 'A' || s.grade === 'B' ? 'route' : 'stop'), { route: 'route', stop: END }) // CODE gate
    .addEdge('route', 'design')
    .addEdge('design', 'designArm').addEdge('designArm', 'designWait')
    .addConditionalEdges('designWait', (s) => (s.decision?.approved ? 'plan' : s.decision?.by === 'timer' ? 'esc' : 'redo'), { plan: 'plan', esc: END, redo: 'designReject' })
    .addEdge('designReject', 'design')
    .addEdge('plan', 'planArm').addEdge('planArm', 'planWait')
    .addConditionalEdges('planWait', (s) => (s.decision?.approved ? 'execute' : 'stop'), { execute: 'execute', stop: END })
    .addEdge('execute', 'openPr').addEdge('openPr', 'mergeArm').addEdge('mergeArm', 'mergeWait')
    .addConditionalEdges('mergeWait', (s) => (s.decision?.approved ? 'merge' : 'stop'), { merge: 'merge', stop: END })
    .addEdge('merge', END);
  return g.compile({ checkpointer: checkpointer() });
}
export { Command };
