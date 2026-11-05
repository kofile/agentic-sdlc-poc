// Durable timeout: nobody ever signals, the gate's condition() timer fires after
// humanTimeoutSec, and the configured onTimeout action applies (auto-reject stops the run;
// escalate ends with escalated-timeout). Uses the time-skipping test environment so the test
// does not actually sleep for humanTimeoutSec.
import { describe, it, expect } from 'vitest';
import { GatePolicySchema } from '../../src/core/gates.ts';
import { withTestEnv, runPipelineOnWorker, buildMockActivities, freshState, TEST_TICKET } from './helpers.ts';

describe('pipeline: human gate timeout', () => {
  it('auto-rejects when nobody responds within humanTimeoutSec', async () => {
    await withTestEnv(async (env) => {
      const policy = GatePolicySchema.parse({ team: 'default', gates: { design: 'human', merge: 'auto' }, humanTimeoutSec: 30, onTimeout: 'auto-reject' });
      const state = freshState(policy);
      const activities = buildMockActivities(state);

      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) =>
        env.client.workflow.execute('pipeline', {
          taskQueue, workflowId: 'timeout-1', args: [{ runId: 'timeout-1', ticket: TEST_TICKET, team: 'default' }],
        }),
      );

      // auto-reject with maxRejectRounds=3 default keeps looping on timeout until the round cap;
      // each round re-runs design and times out again since nobody ever signals.
      expect(['rejected-max-rounds']).toContain(result.status);
      expect(state.designCalls).toBeGreaterThanOrEqual(1);
    });
  }, 60_000);

  it('escalates when nobody responds and the team policy says escalate', async () => {
    await withTestEnv(async (env) => {
      const policy = GatePolicySchema.parse({ team: 'strict', gates: { design: 'human', merge: 'human' }, humanTimeoutSec: 10, onTimeout: 'escalate' });
      const state = freshState(policy);
      const activities = buildMockActivities(state);

      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) =>
        env.client.workflow.execute('pipeline', {
          taskQueue, workflowId: 'timeout-2', args: [{ runId: 'timeout-2', ticket: TEST_TICKET, team: 'strict' }],
        }),
      );

      expect(result.status).toBe('escalated-timeout');
      expect(result.at).toBe('design');
      expect(result.round).toBe(1);
      expect(state.comments.some((c: string) => c.includes('escalated'))).toBe(true);
    });
  }, 60_000);
});
