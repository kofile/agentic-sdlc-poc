import { describe, it, expect } from 'vitest';
import { GatePolicySchema } from '../../src/core/gates.ts';
import { withTestEnv, runPipelineOnWorker, buildMockActivities, freshState, TEST_TICKET, type MockActivityState } from './helpers.ts';

async function run(stage: 'triage' | 'design', id: string) {
  const policy = GatePolicySchema.parse({ team: 'auto', gates: { design: 'auto', plan: 'auto', merge: 'auto' }, humanTimeoutSec: 5 });
  const state: MockActivityState = freshState(policy, { invalidOutputAt: [stage] });
  const result = await withTestEnv((env) => runPipelineOnWorker(env, buildMockActivities(state), async (_w, taskQueue) =>
    env.client.workflow.execute('pipeline', { taskQueue, workflowId: id, args: [{ runId: id, ticket: TEST_TICKET, team: 'auto' }] }),
  ));
  return { state, result };
}

describe('pipeline: invalid model output fails closed', () => {
  it('stops at triage, no later stage runs, ticket to Waiting for Info, failed gate recorded', async () => {
    const { state, result } = await run('triage', 'invalid-triage-1');
    expect(result.status).toBe('stopped-invalid-output');
    expect(result.at).toBe('triage');
    expect(result.reason).toContain('mock invalid output at triage');
    expect(state.stageCalls.triage).toBe(1); // non-retryable: no retry despite maximumAttempts 5
    expect(state.stageCalls.route).toBeUndefined();
    expect(state.designCalls).toBe(0);
    expect(state.executeCalled).toBe(false);
    expect(state.prOpened).toBe(false);
    expect(state.transitions).toEqual(['Waiting for Info']);
    expect(state.gateOutcomes).toEqual([{ stage: 'triage', gate: 'Output valid?', decision: 'fail', reason: 'mock invalid output at triage' }]);
  }, 30_000);

  it('stops at design after triage and route passed, no plan/execute', async () => {
    const { state, result } = await run('design', 'invalid-design-1');
    expect(result.status).toBe('stopped-invalid-output');
    expect(result.at).toBe('design');
    expect(state.designCalls).toBe(1);
    expect(state.stageCalls.plan).toBeUndefined();
    expect(state.executeCalled).toBe(false);
    expect(state.transitions).toEqual(['Waiting for Info']);
    expect(state.gateOutcomes.map((g) => `${g.stage}:${g.gate}:${g.decision}`)).toEqual([
      'triage:A or B?:pass', 'route:Repo identified?:pass', 'design:Output valid?:fail',
    ]);
  }, 30_000);
});
