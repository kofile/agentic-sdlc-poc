// Spec 011 R3: under the committed default team policy, the plan gate is human.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GatePolicySchema } from '../../src/core/gates.ts';
import { withTestEnv, runPipelineOnWorker, buildMockActivities, freshState, TEST_TICKET } from './helpers.ts';
import type { WorkflowHandle } from '@temporalio/client';

const defaultPolicy = () =>
  GatePolicySchema.parse(JSON.parse(readFileSync(new URL('../../teams/default.json', import.meta.url), 'utf8')));

async function waitForWaiting(handle: WorkflowHandle, gate: string, round: number, timeoutMs = 10_000) {
  const t0 = Date.now();
  for (;;) {
    const state = await handle.query<any>('state');
    if (state.waiting?.gate === gate && state.waiting?.round === round) return state;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${gate}#${round}, last state=${JSON.stringify(state)}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('pipeline: human plan gate (default team, committed policy)', () => {
  it('waits at plan after design approval, does not execute, then continues on approve', async () => {
    await withTestEnv(async (env) => {
      const policy = defaultPolicy();
      expect(policy.gates['plan']).toBe('human');
      const state = freshState(policy);
      const activities = buildMockActivities(state);

      const out = await runPipelineOnWorker(env, activities, async (_w, taskQueue) => {
        const handle = await env.client.workflow.start('pipeline', {
          taskQueue, workflowId: 'plan-gate-1', args: [{ runId: 'plan-gate-1', ticket: TEST_TICKET, team: 'default' }],
        });
        await waitForWaiting(handle, 'design', 1);
        await handle.signal('decide', { gate: 'design', round: 1, approved: true });
        const waiting = await waitForWaiting(handle, 'plan', 1);
        const during = { executeCalled: state.executeCalled, prOpened: state.prOpened };
        await handle.signal('decide', { gate: 'plan', round: 1, approved: true });
        const result = await handle.result();
        return { waiting, during, result };
      });

      expect(out.waiting.waiting).toEqual({ gate: 'plan', round: 1 });
      expect(out.during).toEqual({ executeCalled: false, prOpened: false });
      expect(out.result.status).toBe('opened-pr');
      expect(out.result.log).toContain('gate:plan:approved');
      expect(state.executeCalled).toBe(true);
      expect(state.prOpened).toBe(true);
    });
  }, 30_000);

  it('a rejecting decide at plan ends the run as rejected at plan', async () => {
    await withTestEnv(async (env) => {
      const state = freshState(defaultPolicy());
      const activities = buildMockActivities(state);

      const result = await runPipelineOnWorker(env, activities, async (_w, taskQueue) => {
        const handle = await env.client.workflow.start('pipeline', {
          taskQueue, workflowId: 'plan-gate-2', args: [{ runId: 'plan-gate-2', ticket: TEST_TICKET, team: 'default' }],
        });
        await waitForWaiting(handle, 'design', 1);
        await handle.signal('decide', { gate: 'design', round: 1, approved: true });
        await waitForWaiting(handle, 'plan', 1);
        await handle.signal('decide', { gate: 'plan', round: 1, approved: false, feedback: 'no' });
        return handle.result();
      });

      expect(result.status).toBe('rejected');
      expect(result.at).toBe('plan');
      expect(state.executeCalled).toBe(false);
      expect(state.prOpened).toBe(false);
    });
  }, 30_000);
});
