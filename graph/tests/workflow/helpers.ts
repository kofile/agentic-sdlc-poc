// Shared harness for workflow tests: @temporalio/testing time-skipping environment, a worker
// wired to activity mocks (never the real Docker/stub-reasoning adapters — workflow tests
// exercise the graph's control flow, not the adapters), and small signal/query helpers.
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { fileURLToPath } from 'node:url';
import { ApplicationFailure } from '@temporalio/activity';
import type { GatePolicy } from '../../src/core/gates.ts';
import type { Ticket } from '../../src/core/schemas.ts';

export const TEST_TICKET: Ticket = { id: 'T-TEST-1', title: 'Add a thing', description: 'desc', labels: [] };

export interface MockActivityState {
  policy: GatePolicy;
  triageGrade: 'A' | 'B' | 'C' | 'D';
  /** Stages whose mock activity throws a non-retryable ReasoningOutputInvalid. */
  invalidOutputAt: Array<'triage' | 'route' | 'design' | 'plan'>;
  /** Activity invocations per model stage, to prove a failed stage is not retried. */
  stageCalls: Record<string, number>;
  routeRepos: string[];
  designCalls: number;
  gateOutcomes: Array<{ stage: string; gate: string; decision: string; reason: string }>;
  executeCalled: boolean;
  prOpened: boolean;
  transitions: string[];
  comments: string[];
}

export function freshState(policy: GatePolicy, overrides: Partial<MockActivityState> = {}): MockActivityState {
  return {
    policy, triageGrade: 'A', invalidOutputAt: [], stageCalls: {}, routeRepos: ['repo-a'], designCalls: 0, gateOutcomes: [],
    executeCalled: false, prOpened: false, transitions: [], comments: [],
    ...overrides,
  };
}

function maybeInvalid(state: MockActivityState, stage: 'triage' | 'route' | 'design' | 'plan') {
  state.stageCalls[stage] = (state.stageCalls[stage] ?? 0) + 1;
  if (state.invalidOutputAt.includes(stage)) {
    throw ApplicationFailure.nonRetryable(`mock invalid output at ${stage}`, 'ReasoningOutputInvalid', { stage, kind: 'schema_invalid' });
  }
}

export function buildMockActivities(state: MockActivityState) {
  return {
    loadPolicy: async (_team: string) => state.policy,
    recordGateOutcome: async (_runId: string, _ticketId: string, stage: string, gate: string, decision: 'pass' | 'fail', reason: string) => {
      state.gateOutcomes.push({ stage, gate, decision, reason });
    },
    triage: async (_runId: string, _ticket: Ticket) => (maybeInvalid(state, 'triage'), {
      output: { grade: state.triageGrade, reason: 'mock', issues: [] },
      usage: { input: 10, output: 10, model_requested: 'mock-model', model_served: 'mock-model' },
      llm_calls: 1,
    }),
    route: async (_runId: string, _ticket: Ticket) => (maybeInvalid(state, 'route'), {
      output: { repos: state.routeRepos.map((name) => ({ name, role: 'implementer', confidence: 0.9 })), order: state.routeRepos },
      usage: { input: 10, output: 10, model_requested: 'mock-model', model_served: 'mock-model' },
      llm_calls: 1,
    }),
    design: async (_runId: string, _ticket: Ticket, feedback: string | null, round: number) => {
      state.designCalls++;
      maybeInvalid(state, 'design');
      return {
        output: { summary: `design r${round}${feedback ? ` fb=${feedback}` : ''}`, approach: 'mock approach', interfaces: [], risks: [], round },
        usage: { input: 10, output: 10, model_requested: 'mock-model', model_served: 'mock-model' },
        llm_calls: 1,
      };
    },
    plan: async (_runId: string, _ticket: Ticket, _design: unknown) => (maybeInvalid(state, 'plan'), {
      output: { tasks: [{ id: 'T1', title: 'do it', files: [], steps: ['step 1'] }] },
      usage: { input: 10, output: 10, model_requested: 'mock-model', model_served: 'mock-model' },
      llm_calls: 1,
    }),
    execute: async (_runId: string, _ticket: Ticket, _plan: unknown) => {
      state.executeCalled = true;
      return { branch: 'agent/mock', commit: 'deadbeef', jobId: 'mock-job', state: 'succeeded' };
    },
    openPr: async (_runId: string, _ticket: Ticket, _exec: unknown) => {
      state.prOpened = true;
      return { number: 1, url: 'https://example.invalid/pr/1' };
    },
    commentTicket: async (_runId: string, _ticketId: string, body: string) => { state.comments.push(body); },
    transitionTicket: async (_runId: string, _ticketId: string, status: string) => { state.transitions.push(status); },
  };
}

export async function withTestEnv<T>(fn: (env: TestWorkflowEnvironment) => Promise<T>): Promise<T> {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  try {
    return await fn(env);
  } finally {
    await env.teardown();
  }
}

export async function runPipelineOnWorker(env: TestWorkflowEnvironment, activities: ReturnType<typeof buildMockActivities>, run: (worker: Worker, taskQueue: string) => Promise<any>) {
  const taskQueue = `test-${Math.random().toString(36).slice(2)}`;
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath: fileURLToPath(new URL('../../src/workflow/workflows.ts', import.meta.url)),
    activities,
  });
  return worker.runUntil(run(worker, taskQueue));
}
