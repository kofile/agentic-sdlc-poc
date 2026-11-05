// Covers: duplicate signal for the same gate+round, and a stale signal for a round that has
// already closed (e.g. round 1 after the workflow moved on to round 2). Both must be ignored
// and logged, never double-applied (spike-02 B: gate+round keying).
import { describe, it, expect } from 'vitest';
import { GatePolicySchema } from '../../src/core/gates.ts';
import { withTestEnv, runPipelineOnWorker, buildMockActivities, freshState, TEST_TICKET } from './helpers.ts';
import type { WorkflowHandle } from '@temporalio/client';

async function waitForWaiting(handle: WorkflowHandle, gate: string, round: number, timeoutMs = 10_000) {
  const t0 = Date.now();
  for (;;) {
    const state = await handle.query<any>('state');
    if (state.waiting?.gate === gate && state.waiting?.round === round) return state;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${gate}#${round}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('pipeline: duplicate and stale approvals', () => {
  it('a duplicate approval for the same gate+round is ignored after the first is applied', async () => {
    await withTestEnv(async (env) => {
      const policy = GatePolicySchema.parse({ team: 'default', gates: { design: 'human', merge: 'auto' }, humanTimeoutSec: 3600 });
      const state = freshState(policy);
      const activities = buildMockActivities(state);

      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) => {
        const handle = await env.client.workflow.start('pipeline', {
          taskQueue, workflowId: 'dup-1', args: [{ runId: 'dup-1', ticket: TEST_TICKET, team: 'default' }],
        });
        await waitForWaiting(handle, 'design', 1);
        await handle.signal('decide', { gate: 'design', round: 1, approved: true });
        // Duplicate, sent after the gate has already resolved and the workflow moved on.
        await handle.signal('decide', { gate: 'design', round: 1, approved: false, feedback: 'late duplicate' });
        const r = await handle.result();
        const final = await handle.query<any>('state');
        return { r, final };
      });

      expect(result.r.status).toBe('opened-pr');
      // The duplicate must not have flipped the already-approved round 1 decision.
      expect(result.final.ignoredDuplicates).toBeGreaterThanOrEqual(1);
    });
  }, 30_000);

  it('concurrent duplicate signals for the same gate+round yield exactly one applied decision', async () => {
    await withTestEnv(async (env) => {
      const policy = GatePolicySchema.parse({ team: 'default', gates: { design: 'human', merge: 'auto' }, humanTimeoutSec: 3600 });
      const state = freshState(policy);
      const activities = buildMockActivities(state);

      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) => {
        const handle = await env.client.workflow.start('pipeline', {
          taskQueue, workflowId: 'dup-2', args: [{ runId: 'dup-2', ticket: TEST_TICKET, team: 'default' }],
        });
        await waitForWaiting(handle, 'design', 1);
        // Fire several signals "concurrently" for the same gate+round: Temporal workflow code
        // runs single-threaded, so only the first to be processed is accepted (spike-02 B3/B4).
        // All three agree (approved) so the assertion below is independent of delivery order —
        // the invariant under test is "exactly one accepted", not "which one wins".
        await Promise.all([
          handle.signal('decide', { gate: 'design', round: 1, approved: true, by: 'alice' }),
          handle.signal('decide', { gate: 'design', round: 1, approved: true, by: 'bob' }),
          handle.signal('decide', { gate: 'design', round: 1, approved: true, by: 'carol' }),
        ]);
        const r = await handle.result();
        const final = await handle.query<any>('state');
        return { r, final };
      });

      expect(result.r.status).toBe('opened-pr'); // exactly one of the three concurrent signals was accepted
      expect(result.r.designRounds).toBe(1);
      expect(result.final.ignoredDuplicates).toBe(2); // the other two were dropped
    });
  }, 30_000);

  it('a stale approval for an already-closed round is ignored once the next round is waiting', async () => {
    await withTestEnv(async (env) => {
      const policy = GatePolicySchema.parse({ team: 'default', gates: { design: 'human', merge: 'auto' }, humanTimeoutSec: 3600 });
      const state = freshState(policy);
      const activities = buildMockActivities(state);

      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) => {
        const handle = await env.client.workflow.start('pipeline', {
          taskQueue, workflowId: 'stale-1', args: [{ runId: 'stale-1', ticket: TEST_TICKET, team: 'default' }],
        });
        await waitForWaiting(handle, 'design', 1);
        await handle.signal('decide', { gate: 'design', round: 1, approved: false, feedback: 'try again' });
        await waitForWaiting(handle, 'design', 2);
        // Stale: round 1 has already closed (rejected) and the workflow is now waiting on round 2.
        await handle.signal('decide', { gate: 'design', round: 1, approved: true, feedback: 'late approval for closed round' });
        await handle.signal('decide', { gate: 'design', round: 2, approved: true });
        const r = await handle.result();
        return r;
      });

      expect(result.status).toBe('opened-pr');
      expect(result.designRounds).toBe(2);
    });
  }, 30_000);
});
