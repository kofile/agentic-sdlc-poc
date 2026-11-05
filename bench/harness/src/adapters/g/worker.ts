// Spawn and reap the graph worker for one run (spec 006 R2b/R2e). Detached process-group leader,
// per-run task queue, group SIGKILL on every exit path (same pattern as TASK-0043's integration fix).
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface GraphWorker {
  proc: ChildProcess;
  /** SIGKILL the whole process group, tolerating an already-dead group, then wait (bounded) for exit. */
  stop(): Promise<void>;
}

export interface StartWorkerOptions {
  graphRoot: string;
  queue: string;
  env?: NodeJS.ProcessEnv;
  /** Optional file that receives the worker's stdout/stderr. */
  logFile?: string;
  upTimeoutMs?: number;
  /** Override for tests: executable and args (default: node --import tsx src/workflow/worker.ts). */
  command?: { exe: string; args: string[] };
}

const live = new Set<number>();
let exitHookInstalled = false;

function killGroup(pid: number): void {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ESRCH') throw e;
  }
}

/** Synchronous last-resort cleanup so a crashed harness never strands a worker group. */
function installExitHook(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.on('exit', () => {
    for (const pid of live) {
      try {
        killGroup(pid);
      } catch {
        /* best effort */
      }
    }
  });
}

/** Fail fast when graph dependencies are not installed. */
export function checkGraphInstalled(graphRoot: string): void {
  if (!fs.existsSync(path.join(graphRoot, 'node_modules'))) {
    throw new Error(`G: graph/node_modules is missing; run "npm ci" in ${graphRoot}`);
  }
}

/** Fail fast when Temporal is unreachable. `@temporalio/client` is loaded lazily to keep the core light. */
export async function checkTemporalReachable(address: string): Promise<void> {
  const { Connection } = await import('@temporalio/client');
  try {
    const c = await Connection.connect({ address, connectTimeout: '5s' });
    await c.close();
  } catch (e) {
    throw new Error(`G: Temporal is not reachable at ${address} (${(e as Error).message.split('\n')[0]})`);
  }
}

export async function startGraphWorker(opts: StartWorkerOptions): Promise<GraphWorker> {
  installExitHook();
  const exe = opts.command?.exe ?? process.execPath;
  const args = opts.command?.args ?? ['--import', 'tsx', 'src/workflow/worker.ts'];
  const proc = spawn(exe, args, {
    cwd: opts.graphRoot,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env, TEMPORAL_TASK_QUEUE: opts.queue },
  });
  const pid = proc.pid;
  if (pid === undefined) throw new Error('G: failed to spawn the graph worker');
  live.add(pid);

  let exited = false;
  const exitP = new Promise<void>((resolve) => {
    proc.once('exit', () => {
      exited = true;
      live.delete(pid);
      resolve();
    });
  });

  let out = '';
  let tail = '';
  const sink = (d: Buffer): void => {
    const s = d.toString();
    if (opts.logFile) fs.appendFileSync(opts.logFile, s);
    tail = (tail + s).slice(-400);
  };
  const stop = async (): Promise<void> => {
    if (!exited || live.has(pid)) killGroup(pid);
    live.delete(pid);
    await Promise.race([exitP, new Promise<void>((r) => setTimeout(r, 5000))]);
  };
  const worker: GraphWorker = { proc, stop };

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`G: graph worker not up within ${(opts.upTimeoutMs ?? 30_000) / 1000}s`)), opts.upTimeoutMs ?? 30_000);
      proc.stdout!.on('data', (d: Buffer) => {
        sink(d);
        out += d.toString();
        if (out.includes('[worker] up')) {
          clearTimeout(timer);
          resolve();
        }
      });
      proc.stderr!.on('data', sink);
      proc.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`G: graph worker exited early (code ${code}): ${tail.replace(/\s+/g, ' ').trim()}`));
      });
    });
  } catch (e) {
    await stop();
    throw e;
  }
  return worker;
}
