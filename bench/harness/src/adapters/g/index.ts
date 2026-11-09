// G adapter (spec 006): runs one graph workflow per bench run and normalises its telemetry.
// Workflow type and argument shape are restated from graph/src/workflow/workflows.ts (`pipeline`,
// PipelineInput); nothing is imported from graph/src.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Stage } from '../../record.ts';
import type { AdapterEvent, ContenderAdapter, RunContext } from '../types.ts';
import { GRAPH_ROOT, GRAPH_TELEMETRY_FILE, REPO_ROOT, TICKETS_ROOT } from './paths.ts';
import { validateGStages } from './stages.ts';
import { checkStubPolicy, ensureNoRealModelGap } from './stub-policy.ts';
import { loadTicket } from './ticket.ts';
import { readGraphTelemetry, toStageEvents, type GraphLine } from './telemetry.ts';
import { newGateState, pollGates, type GateHandle } from './gates.ts';
import { checkGraphInstalled, checkTemporalReachable, startGraphWorker } from './worker.ts';

const TEAMS = ['auto', 'default', 'strict'] as const;
const GATE_POLL_MS = 250;
const TELEMETRY_POLL_MS = 500;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function resolveTeam(env: NodeJS.ProcessEnv): string {
  const team = env.BENCH_G_TEAM ?? 'auto';
  if (!(TEAMS as readonly string[]).includes(team)) throw new Error(`G: BENCH_G_TEAM must be one of ${TEAMS.join('|')} (got "${team}")`);
  return team;
}

function resolveBudget(env: NodeJS.ProcessEnv): number {
  const raw = env.BENCH_G_BUDGET_SECONDS;
  if (raw === undefined || raw === '') return 60;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`G: BENCH_G_BUDGET_SECONDS must be a positive number (got "${raw}")`);
  return n;
}

/**
 * Has the last requested stage produced everything a record needs? Triage/route also need their
 * gate-outcome line; design/plan also need the workflow's gate to have been decided (state log).
 */
function lastStageSettled(lines: GraphLine[], stage: Stage, log: string[]): boolean {
  const mine = lines.filter((l) => l.stage === stage);
  if (!mine.some((l) => !l.gate)) return false;
  if (stage === 'triage' || stage === 'route') return mine.some((l) => l.gate);
  if (stage === 'design' || stage === 'plan') return log.some((e) => e.startsWith(`gate:${stage}:`) && !e.includes('ignored'));
  return true;
}

export const gAdapter: ContenderAdapter = {
  id: 'G',

  async version(): Promise<string> {
    const pkg = JSON.parse(fs.readFileSync(path.join(GRAPH_ROOT, 'package.json'), 'utf8')) as { version?: string };
    let sha = 'unknown';
    try {
      sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'unknown';
    } catch {
      /* fall through */
    }
    if (sha === 'unknown') process.stderr.write('G: git is unavailable; contender version ends in +unknown\n');
    return `graph@${pkg.version ?? 'unknown'}+${sha}`;
  },

  async *run(ctx: RunContext): AsyncGenerator<AdapterEvent> {
    const refusal = checkStubPolicy(process.env);
    if (refusal) throw new Error(refusal);
    const bad = validateGStages(ctx.stages);
    if (bad) throw new Error(bad);
    const team = resolveTeam(process.env);
    const budgetSeconds = resolveBudget(process.env);
    const ticket = loadTicket(TICKETS_ROOT, ctx.ticket_id);
    const address = process.env.TEMPORAL_ADDRESS ?? '127.0.0.1:7233';
    checkGraphInstalled(GRAPH_ROOT);
    await checkTemporalReachable(address);

    const queue = `bench-g-${ctx.run_id}`;
    const { Connection, Client } = await import('@temporalio/client');
    const worker = await startGraphWorker({ graphRoot: GRAPH_ROOT, queue, logFile: path.join(ctx.artifact_dir, 'worker.log') });
    let workflowResult: string | undefined;
    let workflowError: unknown;
    const gate = newGateState();
    try {
      const connection = await Connection.connect({ address });
      try {
        const client = new Client({ connection, namespace: 'default' });
        const handle = await client.workflow.start('pipeline', {
          taskQueue: queue,
          workflowId: ctx.run_id,
          args: [{ runId: ctx.run_id, ticket, team, budgetSeconds }],
        });
        const gh: GateHandle = {
          query: (n) => handle.query(n),
          signal: (n, a) => handle.signal(n, a),
        };
        let settled = false;
        const resultP = handle.result().then(
          (r) => {
            settled = true;
            workflowResult = (r as { status?: string } | undefined)?.status;
          },
          (e) => {
            settled = true;
            workflowError = e;
          },
        );
        const last = ctx.stages[ctx.stages.length - 1];
        let lastTelemetry = 0;
        while (!settled) {
          let log: string[] = [];
          try {
            const approval = await pollGates(gh, gate, { team });
            if (approval) yield approval.event;
            const s = (await handle.query('state')) as { log?: string[] } | null;
            log = s?.log ?? [];
          } catch (e) {
            if (settled) break;
            if ((e as Error).message.startsWith('G:')) throw e;
            // A query can fail transiently while the workflow is starting or finishing; a dead workflow ends the loop via resultP.
            if (!/not found|completed|closed/i.test((e as Error).message)) await sleep(GATE_POLL_MS);
          }
          if (Date.now() - lastTelemetry >= TELEMETRY_POLL_MS) {
            lastTelemetry = Date.now();
            if (lastStageSettled(readGraphTelemetry(GRAPH_TELEMETRY_FILE, ctx.run_id), last, log)) {
              try {
                await handle.cancel();
              } catch {
                /* already finished */
              }
              break;
            }
          }
          await Promise.race([sleep(GATE_POLL_MS), resultP]);
        }
        // Give a cancelled run a bounded moment to close so its last telemetry lands.
        await Promise.race([resultP, sleep(5000)]);
      } finally {
        await connection.close().catch(() => undefined);
      }
    } finally {
      await worker.stop();
    }

    const lines = readGraphTelemetry(GRAPH_TELEMETRY_FILE, ctx.run_id);
    const events = ensureNoRealModelGap(toStageEvents(lines, ctx.stages, { workflowResult }));
    if (events.length === 0 && workflowError) throw new Error(`G: workflow failed before any stage recorded: ${(workflowError as Error).message.split('\n')[0]}`);
    for (const ev of events) {
      const waited = gate.waitedMs.get(ev.stage);
      if (waited) {
        ev.waiting_ms = (ev.waiting_ms ?? 0) + waited;
        if (ev.active_ms !== undefined) ev.active_ms = Math.max(0, ev.active_ms - waited);
      }
      yield ev;
    }
  },
};
