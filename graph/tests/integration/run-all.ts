// Integration script against a REAL Temporal dev server (Docker) and the REAL Docker execute
// host (stub agent, from spike 3's container). Not a Vitest suite: it starts/kills real
// processes and a real worker, which does not fit a time-skipping unit test. Covers:
//   1. kill-the-worker mid-execute and resume (spike-02 test A, adapted to this workflow)
//   2. the Docker execute host stub end to end (spike-03's A/G shape, through the real port)
//
// Prereqs: `docker run -d -p 127.0.0.1:7233:7233 -p 127.0.0.1:8233:8233 temporalio/temporal:latest server start-dev --ip 0.0.0.0`
//          and the execute-host image built: `docker build -t sdlc-graph-poc-execute-host:latest graph/container`
// Run: npm run test:integration   (from graph/)
import { spawn, type ChildProcess } from 'node:child_process';
import { makeClient, TASK_QUEUE } from '../../src/workflow/client.ts';
import { parseTicketFile } from '../../src/cli/parse-ticket.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const GRAPH_ROOT = path.resolve(here, '../..');

let failures = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) { console.error(`FAIL: ${msg}`); failures++; } else { console.log(`PASS: ${msg}`); }
}

function startWorker(): ChildProcess {
  const p = spawn('npx', ['tsx', 'src/workflow/worker.ts'], { cwd: GRAPH_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => process.stdout.write(`[worker] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[worker:err] ${d}`));
  return p;
}

async function waitForWorkerUp(p: ChildProcess, timeoutMs = 15_000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('worker did not come up in time')), timeoutMs);
    const onData = (d: Buffer) => { if (d.toString().includes('[worker] up')) { clearTimeout(t); p.stdout!.off('data', onData); resolve(); } };
    p.stdout!.on('data', onData);
  });
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function test1_killWorkerMidExecuteAndResume() {
  console.log('\n=== Test 1: kill worker mid-execute, resume ===');
  const client = await makeClient();
  const ticket = parseTicketFile(path.join(GRAPH_ROOT, 'tickets/sample-ticket.md'));
  const runId = `it-kill-${Date.now()}`;
  let worker = startWorker();
  await waitForWorkerUp(worker);

  const handle = await client.workflow.start('pipeline', {
    taskQueue: TASK_QUEUE,
    workflowId: runId,
    args: [{ runId, ticket, team: 'auto', budgetSeconds: 25 }],
  });

  // Wait until the workflow reaches 'execute' (the heartbeat-monitored agentic stage).
  const t0 = Date.now();
  for (;;) {
    const s = await handle.query<any>('state');
    if (s.step === 'execute') break;
    if (Date.now() - t0 > 20_000) throw new Error('never reached execute step');
    await sleep(200);
  }

  console.log('killing worker mid-execute...');
  worker.kill('SIGKILL');
  await sleep(2000); // simulate real downtime

  worker = startWorker();
  await waitForWorkerUp(worker);

  const result = await handle.result();
  assert(result.status === 'opened-pr', `workflow resumed and completed after worker kill (status=${result.status})`);
  worker.kill('SIGKILL');
}

async function test2_dockerExecuteHostEndToEnd() {
  console.log('\n=== Test 2: Docker execute host stub, end to end ===');
  const worker = startWorker();
  await waitForWorkerUp(worker);
  const client = await makeClient();
  const ticket = parseTicketFile(path.join(GRAPH_ROOT, 'tickets/sample-ticket.md'));
  const runId = `it-exec-${Date.now()}`;

  const result = await client.workflow.execute('pipeline', {
    taskQueue: TASK_QUEUE,
    workflowId: runId,
    args: [{ runId, ticket, team: 'auto', budgetSeconds: 25 }],
  });

  assert(result.status === 'opened-pr', `real Docker execute host produced a PR (status=${result.status})`);
  if (result.status === 'opened-pr') {
    assert(typeof result.pr.number === 'number', 'PR has a number');
  }
  const telemetryFile = path.join(GRAPH_ROOT, '.run-state', 'telemetry.jsonl');
  const lines = fs.readFileSync(telemetryFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const executeRecords = lines.filter((l) => l.run_id === runId && l.stage === 'execute');
  assert(executeRecords.length === 1, 'one execute-stage telemetry record was written');
  worker.kill('SIGKILL');
}

async function main() {
  try {
    await test2_dockerExecuteHostEndToEnd();
    await test1_killWorkerMidExecuteAndResume();
  } catch (e) {
    console.error('integration run crashed:', e);
    failures++;
  }
  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
