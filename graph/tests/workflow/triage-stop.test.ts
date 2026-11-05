import { describe, it, expect } from 'vitest';
import { GatePolicySchema } from '../../src/core/gates.ts';
import { withTestEnv, runPipelineOnWorker, buildMockActivities, freshState, TEST_TICKET } from './helpers.ts';

describe('pipeline: triage code gate', () => {
  it('stops at triage for grade C and never reaches route/design', async () => {
    await withTestEnv(async (env) => {
      const policy = GatePolicySchema.parse({ team: 'auto', gates: { design: 'auto', merge: 'auto' }, humanTimeoutSec: 5 });
      const state = freshState(policy, { triageGrade: 'C' });
      const activities = buildMockActivities(state);
      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) =>
        env.client.workflow.execute('pipeline', {
          taskQueue,
          workflowId: 'triage-stop-1',
          args: [{ runId: 'triage-stop-1', ticket: TEST_TICKET, team: 'auto' }],
        }),
      );
      expect(result).toEqual({ status: 'stopped-at-triage', grade: 'C', reason: 'grade C: below pipeline-readiness threshold', log: [] });
      expect(state.designCalls).toBe(0);
      expect(state.executeCalled).toBe(false);
      expect(state.transitions).toEqual(['Waiting for Info']);
    });
  }, 30_000);

  it('stops at triage for grade D the same way', async () => {
    await withTestEnv(async (env) => {
      const policy = GatePolicySchema.parse({ team: 'auto', gates: { design: 'auto', merge: 'auto' }, humanTimeoutSec: 5 });
      const state = freshState(policy, { triageGrade: 'D' });
      const activities = buildMockActivities(state);
      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) =>
        env.client.workflow.execute('pipeline', {
          taskQueue,
          workflowId: 'triage-stop-2',
          args: [{ runId: 'triage-stop-2', ticket: TEST_TICKET, team: 'auto' }],
        }),
      );
      expect(result.status).toBe('stopped-at-triage');
      expect(result.grade).toBe('D');
    });
  }, 30_000);
});
