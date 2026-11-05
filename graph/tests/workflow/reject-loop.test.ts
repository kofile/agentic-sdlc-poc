import { describe, it, expect } from 'vitest';
import { GatePolicySchema } from '../../src/core/gates.ts';
import { withTestEnv, runPipelineOnWorker, buildMockActivities, freshState, TEST_TICKET } from './helpers.ts';
import type { WorkflowHandle } from '@temporalio/client';

async function waitForWaiting(handle: WorkflowHandle, gate: string, round: number, timeoutMs = 10_000) {
  const t0 = Date.now();
  for (;;) {
    const state = await handle.query<any>('state');
    if (state.waiting?.gate === gate && state.waiting?.round === round) return state;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${gate}#${round}, last state=${JSON.stringify(state)}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('pipeline: reject-and-redo loop', () => {
  it('reject with feedback loops back to design, then approve proceeds', async () => {
    await withTestEnv(async (env) => {
      const policy = GatePolicySchema.parse({ team: 'default', gates: { design: 'human', merge: 'auto' }, humanTimeoutSec: 3600 });
      const state = freshState(policy);
      const activities = buildMockActivities(state);

      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) => {
        const handle = await env.client.workflow.start('pipeline', {
          taskQueue,
          workflowId: 'reject-loop-1',
          args: [{ runId: 'reject-loop-1', ticket: TEST_TICKET, team: 'default' }],
        });
        await waitForWaiting(handle, 'design', 1);
        await handle.signal('decide', { gate: 'design', round: 1, approved: false, feedback: 'needs more detail' });
        await waitForWaiting(handle, 'design', 2);
        await handle.signal('decide', { gate: 'design', round: 2, approved: true });
        return handle.result();
      });

      expect(result.status).toBe('opened-pr');
      expect(result.designRounds).toBe(2);
      expect(state.designCalls).toBe(2);
      expect(result.log).toContain('gate:design:rejected');
      expect(result.log).toContain('gate:design:approved');
    });
  }, 30_000);

  it('stops after maxRejectRounds rejects', async () => {
    await withTestEnv(async (env) => {
      const policy = GatePolicySchema.parse({ team: 'default', gates: { design: 'human', merge: 'auto' }, humanTimeoutSec: 3600, maxRejectRounds: 2 });
      const state = freshState(policy);
      const activities = buildMockActivities(state);

      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) => {
        const handle = await env.client.workflow.start('pipeline', {
          taskQueue,
          workflowId: 'reject-loop-2',
          args: [{ runId: 'reject-loop-2', ticket: TEST_TICKET, team: 'default' }],
        });
        await waitForWaiting(handle, 'design', 1);
        await handle.signal('decide', { gate: 'design', round: 1, approved: false, feedback: 'no' });
        await waitForWaiting(handle, 'design', 2);
        await handle.signal('decide', { gate: 'design', round: 2, approved: false, feedback: 'still no' });
        return handle.result();
      });

      expect(result.status).toBe('rejected-max-rounds');
      expect(result.at).toBe('design');
    });
  }, 30_000);
});
