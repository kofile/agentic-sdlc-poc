// Activities = every non-deterministic / side-effecting thing, per Temporal's determinism rule
// (workflows.ts must stay pure). Thin wrappers over ports/adapters wired in container.ts.
import { heartbeat } from '@temporalio/activity';
import {
  TicketSchema, TriageOutputSchema, RouteOutputSchema, DesignOutputSchema, PlanOutputSchema,
  type Ticket, type TriageOutput, type RouteOutput, type DesignOutput, type PlanOutput,
} from '../core/schemas.ts';
import type { GatePolicy } from '../core/gates.ts';
import { appendTelemetry, estimateCostUsd, type StageRunRecord } from '../core/telemetry.ts';
import { reasoning, tracker, docs, vcs, config, executeHost, TELEMETRY_FILE, CONTENDER_VERSION } from './container.ts';
import type { JobSpec } from '../ports/execute-host.ts';
import { TERMINAL } from '../ports/execute-host.ts';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

export const loadPolicy = (team: string): Promise<GatePolicy> => config.loadGatePolicy(team);

export interface StageCallResult<T> { output: T; usage: { input: number; output: number; model_requested: string; model_served: string }; llm_calls: number }

async function recordStage(args: {
  runId: string; ticketId: string; stage: StageRunRecord['stage'];
  startedAt: string; wallMs: number; llmCalls: number; toolCalls?: number;
  tokens: { input: number; output: number }; modelRequested?: string; modelServed?: string;
  status: StageRunRecord['status']; gate?: StageRunRecord['gate']; schemaValid: boolean; artifactRefs?: string[];
}) {
  const prices = await config.loadPriceTable();
  const costUsd = args.modelRequested ? estimateCostUsd(prices, args.modelRequested, { ...args.tokens, cache_read: 0, cache_write: 0 }).usd : 0;
  const record: StageRunRecord = {
    run_id: args.runId,
    benchmark_version: 'v0.1',
    contender: 'G',
    contender_version: CONTENDER_VERSION,
    ticket_id: args.ticketId,
    stage: args.stage,
    started_at: args.startedAt,
    ended_at: new Date().toISOString(),
    wall_ms: args.wallMs,
    active_ms: args.wallMs,
    waiting_ms: 0,
    cold_start_ms: 0,
    model_requested: args.modelRequested,
    model_served: args.modelServed,
    llm_calls: args.llmCalls,
    tool_calls: args.toolCalls ?? 0,
    tokens: { input: args.tokens.input, output: args.tokens.output, cache_read: 0, cache_write: 0, source: 'estimated' },
    cost_usd: { tokens: costUsd, compute: 0, orchestration: 0 },
    status: args.status,
    gate: args.gate ?? null,
    output: { schema_valid: args.schemaValid, artifact_refs: args.artifactRefs ?? [] },
    fix_attempts: 0,
    infra_retries: 0,
    interventions: 0,
    assisted: false,
    failure_label: null,
    failure_note: null,
    scores: { hidden_tests_passed: 0, hidden_tests_total: 0, gates_green: true, rubric: null },
    telemetry_gaps: args.modelRequested ? [] : ['no_model_call'],
    canary_leak: false,
  };
  appendTelemetry(TELEMETRY_FILE, record);
}

const MODEL_REQUESTED = 'claude-sonnet-5';

export async function triage(runId: string, ticket: Ticket): Promise<StageCallResult<TriageOutput>> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const res = await reasoning.call({
    stage: 'triage', prompt: JSON.stringify({ ticket }), schema: TriageOutputSchema,
    modelRequested: MODEL_REQUESTED, idempotencyKey: `${runId}:triage`,
  });
  await recordStage({
    runId, ticketId: ticket.id, stage: 'triage', startedAt, wallMs: Date.now() - t0, llmCalls: res.llm_calls,
    tokens: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    modelRequested: res.usage.model_requested, modelServed: res.usage.model_served,
    status: 'completed', schemaValid: true,
  });
  return { output: res.output, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens, model_requested: res.usage.model_requested, model_served: res.usage.model_served }, llm_calls: res.llm_calls };
}

export async function recordGateOutcome(runId: string, ticketId: string, stage: StageRunRecord['stage'], gateName: string, decision: 'pass' | 'fail', reason: string) {
  await recordStage({
    runId, ticketId, stage, startedAt: new Date().toISOString(), wallMs: 0, llmCalls: 0,
    tokens: { input: 0, output: 0 }, status: decision === 'pass' ? 'completed' : 'stopped_by_gate',
    gate: { name: gateName, decision }, schemaValid: true,
  });
}

export async function route(runId: string, ticket: Ticket): Promise<StageCallResult<RouteOutput>> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const res = await reasoning.call({
    stage: 'route', prompt: JSON.stringify({ ticket }), schema: RouteOutputSchema,
    modelRequested: MODEL_REQUESTED, idempotencyKey: `${runId}:route`,
  });
  await recordStage({
    runId, ticketId: ticket.id, stage: 'route', startedAt, wallMs: Date.now() - t0, llmCalls: res.llm_calls,
    tokens: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    modelRequested: res.usage.model_requested, modelServed: res.usage.model_served,
    status: 'completed', schemaValid: true,
  });
  return { output: res.output, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens, model_requested: res.usage.model_requested, model_served: res.usage.model_served }, llm_calls: res.llm_calls };
}

export async function design(runId: string, ticket: Ticket, feedback: string | null, round: number): Promise<StageCallResult<DesignOutput>> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const res = await reasoning.call({
    stage: 'design', prompt: JSON.stringify({ ticket, feedback, round }), schema: DesignOutputSchema,
    modelRequested: MODEL_REQUESTED, idempotencyKey: `${runId}:design:${round}`,
  });
  const { page } = await docs.upsertPageByTitle(`${ticket.id} — Architecture Design`, JSON.stringify(res.output, null, 2), `${runId}:design-doc:${round}`);
  await recordStage({
    runId, ticketId: ticket.id, stage: 'design', startedAt, wallMs: Date.now() - t0, llmCalls: res.llm_calls,
    tokens: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    modelRequested: res.usage.model_requested, modelServed: res.usage.model_served,
    status: 'completed', schemaValid: true, artifactRefs: [`confluence:${page.id}`],
  });
  return { output: res.output, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens, model_requested: res.usage.model_requested, model_served: res.usage.model_served }, llm_calls: res.llm_calls };
}

export async function plan(runId: string, ticket: Ticket, designOutput: DesignOutput): Promise<StageCallResult<PlanOutput>> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const res = await reasoning.call({
    stage: 'plan', prompt: JSON.stringify({ ticket, design: designOutput }), schema: PlanOutputSchema,
    modelRequested: MODEL_REQUESTED, idempotencyKey: `${runId}:plan`,
  });
  const { page } = await docs.upsertPageByTitle(`${ticket.id} — Implementation Plan`, JSON.stringify(res.output, null, 2), `${runId}:plan-doc`);
  await recordStage({
    runId, ticketId: ticket.id, stage: 'plan', startedAt, wallMs: Date.now() - t0, llmCalls: res.llm_calls,
    tokens: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    modelRequested: res.usage.model_requested, modelServed: res.usage.model_served,
    status: 'completed', schemaValid: true, artifactRefs: [`confluence:${page.id}`],
  });
  return { output: res.output, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens, model_requested: res.usage.model_requested, model_served: res.usage.model_served }, llm_calls: res.llm_calls };
}

export interface ExecuteResult { branch: string; commit: string; jobId: string; state: string }

/** The one agentic stage. Runs the stub agent inside the Docker execute host from spike 3,
 * heartbeating throughout so a killed worker is detected quickly (not just at
 * startToCloseTimeout). Polls the host for terminal state (poll fallback is mandatory per
 * spike 3's finding C). */
export async function execute(runId: string, ticket: Ticket, planOutput: PlanOutput, opts: { budgetSeconds?: number } = {}): Promise<ExecuteResult> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const hb = setInterval(() => heartbeat(), 500);
  try {
    const stateDir = path.resolve(process.cwd(), '.run-state');
    const bareRepoDir = path.join(stateDir, 'bare-repo.git');
    ensureBareRepo(bareRepoDir);
    const promptFile = path.join(stateDir, `prompt-${runId}.md`);
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(promptFile, `Ticket: ${ticket.id}\n\nPlan:\n${JSON.stringify(planOutput, null, 2)}\n`);
    const spec: JobSpec = {
      idempotencyKey: `${runId}:execute`,
      repo: { url: bareRepoDir, baseRef: 'main' },
      promptFile,
      budgetSeconds: opts.budgetSeconds ?? 60,
      limits: { memoryMb: 256, cpus: 0.5, pids: 64 },
      testCommand: 'true',
      secrets: { jobToken: crypto.randomBytes(16).toString('hex'), mode: 'file' },
      stub: { ticketId: ticket.id },
    };
    const handle = await executeHost.start(spec);
    let status = await executeHost.status(handle);
    const deadline = Date.now() + (opts.budgetSeconds ?? 60) * 1000 + 10_000;
    while (!TERMINAL.includes(status.state) && Date.now() < deadline) {
      heartbeat();
      await new Promise((r) => setTimeout(r, 500));
      status = await executeHost.status(handle);
    }
    const result = await executeHost.result(handle);
    await executeHost.cleanup(handle);
    await recordStage({
      runId, ticketId: ticket.id, stage: 'execute', startedAt, wallMs: Date.now() - t0, llmCalls: 0, toolCalls: 1,
      tokens: { input: 0, output: 0 }, status: status.state === 'succeeded' ? 'completed' : 'failed', schemaValid: true,
    });
    return { branch: result.branch ?? 'unknown', commit: result.commit ?? 'unknown', jobId: handle.jobId, state: status.state };
  } finally {
    clearInterval(hb);
  }
}

function ensureBareRepo(dir: string): void {
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir, { recursive: true });
  execSync(`git init --bare -q "${dir}"`);
  const seedDir = dir + '.seed-tmp';
  fs.rmSync(seedDir, { recursive: true, force: true });
  execSync(`git clone -q "${dir}" "${seedDir}"`);
  fs.writeFileSync(path.join(seedDir, 'README.md'), '# graph-sample-repo\n');
  execSync('git -C "' + seedDir + '" checkout -q -b main');
  execSync('git -C "' + seedDir + '" add -A && git -C "' + seedDir + '" -c user.email=a@b.c -c user.name=seed commit -q -m seed');
  execSync('git -C "' + seedDir + '" push -q origin main');
  fs.rmSync(seedDir, { recursive: true, force: true });
}

export async function openPr(runId: string, ticket: Ticket, exec: ExecuteResult): Promise<{ number: number; url: string }> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const { pr } = await vcs.openPr({
    repo: 'graph-sample-repo', branch: exec.branch, baseBranch: 'main',
    title: `feat(${ticket.id}): ${ticket.title}`, body: `Automated PR for ${ticket.id}. Execute job ${exec.jobId} (${exec.state}).`,
    headSha: exec.commit,
  }, `${runId}:open-pr`);
  await recordStage({
    runId, ticketId: ticket.id, stage: 'open_pr', startedAt, wallMs: Date.now() - t0, llmCalls: 0,
    tokens: { input: 0, output: 0 }, status: 'completed', schemaValid: true, artifactRefs: [`pr:${pr.number}`],
  });
  return { number: pr.number, url: pr.url };
}

export async function commentTicket(runId: string, ticketId: string, body: string): Promise<void> {
  await tracker.comment(ticketId, body, `${runId}:comment:${crypto.createHash('sha1').update(body).digest('hex').slice(0, 8)}`);
}

export async function transitionTicket(runId: string, ticketId: string, status: string): Promise<void> {
  await tracker.transition(ticketId, status, `${runId}:transition:${status}`);
}

export const _validateTicket = (t: unknown) => TicketSchema.parse(t);
