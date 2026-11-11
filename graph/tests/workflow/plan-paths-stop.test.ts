import { describe, it, expect } from 'vitest';
import { GatePolicySchema } from '../../src/core/gates.ts';
import { withTestEnv, runPipelineOnWorker, buildMockActivities, freshState, TEST_TICKET } from './helpers.ts';

const policy = () => GatePolicySchema.parse({ team: 'auto', gates: { design: 'auto', plan: 'auto', merge: 'auto' }, humanTimeoutSec: 5 });

describe('pipeline: plan path gate', () => {
  it('stops at plan paths when the gate fails, before execute', async () => {
    await withTestEnv(async (env) => {
      const state = freshState(policy(), { pathGate: { pass: false, reason: 'unknown paths: src/nope.ts' } });
      const result = await runPipelineOnWorker(env, buildMockActivities(state), async (_w, taskQueue) =>
        env.client.workflow.execute('pipeline', {
          taskQueue, workflowId: 'plan-paths-1',
          args: [{ runId: 'plan-paths-1', ticket: TEST_TICKET, team: 'auto' }],
        }),
      );
      expect(result).toEqual({ status: 'stopped-at-plan-paths', reason: 'unknown paths: src/nope.ts', log: expect.any(Array) });
      expect(state.executeCalled).toBe(false);
      expect(state.prOpened).toBe(false);
      expect(state.transitions).toEqual(['Waiting for Info']);
      expect(state.gateOutcomes.at(-1)).toMatchObject({ stage: 'plan', gate: 'Plan paths exist?', decision: 'fail' });
    });
  }, 30_000);

  it('passes the routed repos to design and plan and records a passing gate', async () => {
    await withTestEnv(async (env) => {
      const state = freshState(policy(), { routeRepos: ['repo-a', 'repo-b'] });
      const result = await runPipelineOnWorker(env, buildMockActivities(state), async (_w, taskQueue) =>
        env.client.workflow.execute('pipeline', {
          taskQueue, workflowId: 'plan-paths-2',
          args: [{ runId: 'plan-paths-2', ticket: TEST_TICKET, team: 'auto' }],
        }),
      );
      expect(result.status).toBe('opened-pr');
      expect(state.designRepos).toEqual([['repo-a', 'repo-b']]);
      expect(state.planRepos).toEqual([['repo-a', 'repo-b']]);
      expect(state.gateOutcomes).toContainEqual({ stage: 'plan', gate: 'Plan paths exist?', decision: 'pass', reason: 'ok' });
    });
  }, 30_000);
});
