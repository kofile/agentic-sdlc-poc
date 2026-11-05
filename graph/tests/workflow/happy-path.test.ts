import { describe, it, expect } from 'vitest';
import { GatePolicySchema } from '../../src/core/gates.ts';
import { withTestEnv, runPipelineOnWorker, buildMockActivities, freshState, TEST_TICKET } from './helpers.ts';

describe('pipeline: happy path (auto gates)', () => {
  it('runs triage -> route -> design -> plan -> execute -> open-pr with no waits', async () => {
    await withTestEnv(async (env) => {
      const policy = GatePolicySchema.parse({ team: 'auto', gates: { design: 'auto', merge: 'auto' }, humanTimeoutSec: 5 });
      const state = freshState(policy);
      const activities = buildMockActivities(state);
      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) =>
        env.client.workflow.execute('pipeline', {
          taskQueue,
          workflowId: 'happy-1',
          args: [{ runId: 'happy-1', ticket: TEST_TICKET, team: 'auto' }],
        }),
      );
      expect(result.status).toBe('opened-pr');
      expect(result.pr.number).toBe(1);
      expect(result.designRounds).toBe(1);
      expect(state.executeCalled).toBe(true);
      expect(state.prOpened).toBe(true);
      expect(state.gateOutcomes).toEqual([
        { stage: 'triage', gate: 'A or B?', decision: 'pass', reason: 'grade A' },
        { stage: 'route', gate: 'Repo identified?', decision: 'pass', reason: '1 repo(s) routed' },
      ]);
    });
  }, 30_000);
});
