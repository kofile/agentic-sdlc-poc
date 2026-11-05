// TASK-0027 / spec 002: a workflow definition changes while a run is in flight.
// Real worker swap on a local (non time-skipping) Temporal server: worker v1 runs the real
// `pipeline`, parks at the design gate, is shut down, worker v2 (changed + patched()) takes over
// the same task queue, and the original run completes. Replay of run A's history is the
// negative control: the same change without patched() is a determinism violation.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { DeterminismViolationError } from '@temporalio/workflow';
import { fileURLToPath } from 'node:url';
import { GatePolicySchema } from '../../src/core/gates.ts';
import type { PipelineState } from '../../src/workflow/workflows.ts';
import { buildMockActivities, freshState, TEST_TICKET } from '../workflow/helpers.ts';

const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const V1 = path('../../src/workflow/workflows.ts');
const V2_PATCHED = path('./fixtures/workflows-v2-patched.ts');
const V2_UNPATCHED = path('./fixtures/workflows-v2-unpatched.ts');

const policy = GatePolicySchema.parse({ team: 'human-design', gates: { design: 'human', plan: 'auto', merge: 'auto' }, humanTimeoutSec: 300 });

function activitiesWithPrecheck(state: ReturnType<typeof freshState>, calls: string[]) {
  return { ...buildMockActivities(state), precheck: async (runId: string, _ticket: unknown) => { calls.push(runId); } };
}

async function waitForDesignGate(handle: { query: (q: string) => Promise<unknown> }) {
  for (let i = 0; i < 200; i++) {
    const s = (await handle.query('state')) as PipelineState;
    if (s.waiting?.gate === 'design') return s;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('run never reached the design gate');
}

describe('workflow versioning with a run in flight (patched())', () => {
  let env: TestWorkflowEnvironment;
  beforeAll(async () => { env = await TestWorkflowEnvironment.createLocal(); }, 120_000);
  afterAll(async () => { await env?.teardown(); });

  it('run A survives a v1 -> v2 worker swap; run B takes the new step; replay negative control', async () => {
    const taskQueue = `versioning-${Math.random().toString(36).slice(2)}`;
    const stateA = freshState(policy);
    const precheckCalls: string[] = [];
    const activities = activitiesWithPrecheck(stateA, precheckCalls);

    // --- worker v1 (real workflows.ts); start run A and park it at the design gate ---
    const w1 = await Worker.create({ connection: env.nativeConnection, taskQueue, workflowsPath: V1, activities });
    const w1Done = w1.run();
    const handleA = await env.client.workflow.start('pipeline', {
      taskQueue, workflowId: 'run-a', args: [{ runId: 'run-a', ticket: TEST_TICKET, team: 'human-design' }],
    });
    await waitForDesignGate(handleA);
    expect(precheckCalls).toEqual([]);

    // --- swap: stop v1 entirely, start v2-patched on the same queue ---
    w1.shutdown();
    await w1Done;
    const w2 = await Worker.create({ connection: env.nativeConnection, taskQueue, workflowsPath: V2_PATCHED, activities });
    const w2Done = w2.run();
    try {
      await handleA.signal('decide', { gate: 'design', round: 1, approved: true, by: 'tester' });
      const resultA = await handleA.result();
      expect(resultA.status).toBe('opened-pr');
      expect(resultA.pr.number).toBe(1);
      expect(resultA.designRounds).toBe(1);
      expect(stateA.prOpened).toBe(true);
      expect(stateA.executeCalled).toBe(true);
      expect(stateA.gateOutcomes).toEqual([
        { stage: 'triage', gate: 'A or B?', decision: 'pass', reason: 'grade A' },
        { stage: 'route', gate: 'Repo identified?', decision: 'pass', reason: '1 repo(s) routed' },
      ]);
      // in-flight run keeps the OLD path: the new step is never executed for it
      expect(precheckCalls).not.toContain('run-a');

      // --- run B starts on v2: takes the new path ---
      const handleB = await env.client.workflow.start('pipeline', {
        taskQueue, workflowId: 'run-b', args: [{ runId: 'run-b', ticket: TEST_TICKET, team: 'human-design' }],
      });
      await waitForDesignGate(handleB);
      await handleB.signal('decide', { gate: 'design', round: 1, approved: true, by: 'tester' });
      const resultB = await handleB.result();
      expect(resultB.status).toBe('opened-pr');
      expect(precheckCalls).toEqual(['run-b']);
    } finally {
      w2.shutdown();
      await w2Done;
    }

    // --- negative control: replay run A's history against the two v2 definitions ---
    const history = await handleA.fetchHistory();
    await expect(Worker.runReplayHistory({ workflowsPath: V2_PATCHED }, history, 'run-a')).resolves.toBeUndefined();
    const err = await Worker.runReplayHistory({ workflowsPath: V2_UNPATCHED }, history, 'run-a').then(
      () => undefined, (e: unknown) => e,
    );
    console.log(`[negative control] ${(err as Error)?.name}: ${(err as Error)?.message}`);
    expect(err).toBeInstanceOf(DeterminismViolationError);
    expect((err as Error).message).toMatch(/precheck/);
  }, 120_000);
});
