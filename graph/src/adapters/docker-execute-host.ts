import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import type { ExecuteHost, JobSpec, JobHandle, JobStatus, JobResult, LogLine, CancelResult, JobState, Usage } from '../ports/execute-host.ts';
import { TERMINAL } from '../ports/execute-host.ts';

const execFileP = promisify(execFile);
export async function docker(args: string[], opts: { allowFail?: boolean } = {}) {
  try { const { stdout } = await execFileP('docker', args, { maxBuffer: 64 * 1024 * 1024 }); return { ok: true, out: stdout.trim() }; }
  catch (e: any) { if (opts.allowFail) return { ok: false, out: String(e.stderr || e.message).trim() }; throw e; }
}
const readJson = (p: string) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const exists = (p: string) => fs.existsSync(p);

export class DockerExecuteHost implements ExecuteHost {
  cfg: { stateDir: string; image: string; ownerId: string; hardKillGraceMs?: number };
  constructor(cfg: { stateDir: string; image: string; ownerId: string; hardKillGraceMs?: number }) { this.cfg = cfg; }
  jobDir(id: string) { return path.join(this.cfg.stateDir, 'jobs', id); }
  private name(id: string) { return `sdlcpoc-${id}`; }
  private handleOf(id: string, deadlineAt: number, createdAt: number): JobHandle { return { jobId: id, backend: 'docker', ref: this.name(id), createdAt, deadlineAt }; }

  async start(spec: JobSpec): Promise<JobHandle> {
    const id = 'j-' + crypto.createHash('sha256').update(spec.idempotencyKey).digest('hex').slice(0, 10);
    const dir = this.jobDir(id);
    const existing = readJson(path.join(dir, 'handle.json'));
    if (existing && (await docker(['inspect', this.name(id)], { allowFail: true })).ok) return existing; // idempotent
    for (const d of ['in', 'out', 'secrets']) fs.mkdirSync(path.join(dir, d), { recursive: true });
    fs.chmodSync(path.join(dir, 'out'), 0o777);
    fs.copyFileSync(spec.promptFile, path.join(dir, 'in/prompt.md'));
    const { secrets, ...publicSpec } = spec;
    fs.writeFileSync(path.join(dir, 'in/job.json'), JSON.stringify({ ...publicSpec, jobId: id, baseRef: spec.repo.baseRef }));
    const cbSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(path.join(dir, 'secrets/callback_secret'), cbSecret, { mode: 0o600 });
    const mode = secrets.mode ?? 'file';
    if (mode === 'file') fs.writeFileSync(path.join(dir, 'secrets/job_token'), secrets.jobToken, { mode: 0o600 });
    const now = Date.now();
    const handle = this.handleOf(id, now + spec.budgetSeconds * 1000, now);
    fs.writeFileSync(path.join(dir, 'handle.json'), JSON.stringify(handle));
    const L = spec.limits;
    const args = ['run', '-d', '--init', '--name', this.name(id),
      '--label', 'sdlcpoc.managed=true', '--label', `sdlcpoc.owner=${this.cfg.ownerId}`, '--label', `sdlcpoc.job=${id}`,
      '--label', `sdlcpoc.deadline=${handle.deadlineAt}`, '--label', `sdlcpoc.created=${now}`,
      '--memory', `${L.memoryMb}m`, '--memory-swap', `${L.memoryMb}m`, '--cpus', String(L.cpus), '--pids-limit', String(L.pids),
      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--user', `${process.getuid!()}:${process.getgid!()}`,
      '--add-host', 'host.docker.internal:host-gateway',
      '-v', `${path.resolve(spec.repo.url)}:/remote.git`,
      '-v', `${path.join(dir, 'in')}:/job:ro`, '-v', `${path.join(dir, 'out')}:/out`, '-v', `${path.join(dir, 'secrets')}:/run/secrets:ro`];
    if (mode === 'env') args.push('-e', `JOB_TOKEN=${secrets.jobToken}`);
    args.push(this.cfg.image);
    await docker(args);
    return handle;
  }

  async attach(jobId: string) { return readJson(path.join(this.jobDir(jobId), 'handle.json')); }

  private async inspect(h: JobHandle) {
    const r = await docker(['inspect', h.ref], { allowFail: true });
    return r.ok ? JSON.parse(r.out)[0] : null;
  }

  async status(h: JobHandle): Promise<JobStatus> {
    const dir = this.jobDir(h.jobId);
    let c = await this.inspect(h);
    // Host-side deadline backstop: a running container past deadline+grace is killed (covers a wedged runner).
    if (c?.State.Running && Date.now() > h.deadlineAt + (this.cfg.hardKillGraceMs ?? 6000)) {
      fs.writeFileSync(path.join(dir, 'host_killed'), 'deadline');
      await docker(['kill', h.ref], { allowFail: true });
      c = await this.inspect(h);
    }
    const res = readJson(path.join(dir, 'out/result.json'));
    const startedAt = c ? Date.parse(c.State.StartedAt) : undefined;
    if (c?.State.Running && !res) {
      const evs = exists(path.join(dir, 'out/events.ndjson')) && fs.statSync(path.join(dir, 'out/events.ndjson')).size > 0;
      return { state: evs ? 'running' : 'starting', startedAt };
    }
    const finishedAt = c ? Date.parse(c.State.FinishedAt) : undefined;
    const cancelled = exists(path.join(dir, 'cancel_requested'));
    const exitCode = c?.State.ExitCode;
    if (res) { // runner finished the work (it may still be retrying its callback)
      if (res.status === 'failed' && c?.State.OOMKilled) return { state: 'oom_killed', reason: `memory_limit (runner saw ${res.reason})`, exitCode: res.exitCode ?? exitCode, oomKilled: true, startedAt, finishedAt };
      const m: Record<string, JobState> = { succeeded: 'succeeded', failed: 'failed', timed_out: 'timed_out', terminated: cancelled ? 'cancelled' : 'failed' };
      return { state: m[res.status] ?? 'failed', reason: res.status === 'terminated' && !cancelled ? 'terminated_externally' : res.reason, exitCode: res.exitCode ?? exitCode, startedAt, finishedAt };
    }
    if (cancelled) return { state: 'cancelled', reason: 'cancel_requested', exitCode, startedAt, finishedAt, inferred: true };
    if (exists(path.join(dir, 'host_killed'))) return { state: 'timed_out', reason: 'host_deadline_kill', exitCode, startedAt, finishedAt, inferred: true };
    if (!c) return { state: 'lost', reason: 'container_missing_no_result', inferred: true };
    if (c.State.OOMKilled) return { state: 'oom_killed', reason: 'memory_limit', exitCode, oomKilled: true, startedAt, finishedAt, inferred: true };
    if (cancelled) return { state: 'cancelled', reason: 'cancel_requested', exitCode, startedAt, finishedAt, inferred: true };
    if (exists(path.join(dir, 'host_killed'))) return { state: 'timed_out', reason: 'host_deadline_kill', exitCode, startedAt, finishedAt, inferred: true };
    return { state: 'failed', reason: `exit_${exitCode}_no_result`, exitCode, startedAt, finishedAt, inferred: true };
  }

  async *logs(h: JobHandle, opts: { follow?: boolean } = {}): AsyncIterable<LogLine> {
    const p = spawn('docker', ['logs', ...(opts.follow ? ['-f'] : []), h.ref], { stdio: ['ignore', 'pipe', 'pipe'] });
    const q: LogLine[] = []; let wake: (() => void) | null = null; let open = 2;
    const pipe = (s: NodeJS.ReadableStream, stream: 'stdout' | 'stderr') => {
      const rl = readline.createInterface({ input: s });
      rl.on('line', (text) => { q.push({ stream, text, receivedAt: Date.now() }); wake?.(); });
      rl.on('close', () => { open--; wake?.(); });
    };
    pipe(p.stdout!, 'stdout'); pipe(p.stderr!, 'stderr');
    try {
      while (open > 0 || q.length) {
        if (q.length) yield q.shift()!;
        else await new Promise<void>((r) => { wake = r; });
      }
    } finally { p.kill(); }
  }

  async cancel(h: JobHandle, opts: { graceSeconds?: number } = {}): Promise<CancelResult> {
    const requestedAt = Date.now();
    fs.writeFileSync(path.join(this.jobDir(h.jobId), 'cancel_requested'), String(requestedAt));
    await docker(['stop', '-t', String(opts.graceSeconds ?? 10), h.ref], { allowFail: true });
    const stoppedAt = Date.now();
    return { requestedAt, stoppedAt, latencyMs: stoppedAt - requestedAt, state: (await this.status(h)).state };
  }

  async result(h: JobHandle): Promise<JobResult> {
    const out = path.join(this.jobDir(h.jobId), 'out');
    const status = await this.status(h);
    const res = readJson(path.join(out, 'result.json'));
    let usage: Usage | undefined = readJson(path.join(out, 'usage.json')) ?? undefined; let usageSource: JobResult['usageSource'] = usage ? 'usage.json' : 'none';
    if (!usage && exists(path.join(out, 'events.ndjson'))) { // fall back to the last usage seen in the event stream
      for (const l of fs.readFileSync(path.join(out, 'events.ndjson'), 'utf8').split('\n').reverse()) {
        try { const e = JSON.parse(l); const u = e.message?.usage ?? e.usage; if (u?.input_tokens != null) { usage = { ...u, total_cost_usd: +(u.input_tokens * 2e-6 + u.output_tokens * 1e-5).toFixed(6), partial: true }; usageSource = 'events'; break; } } catch {}
      }
    }
    return { status, branch: res?.branch, commit: res?.commit, patchPath: exists(path.join(out, 'patch.diff')) ? path.join(out, 'patch.diff') : undefined, usage, usageSource, eventsPath: path.join(out, 'events.ndjson'), callback: res?.callback };
  }

  async list() {
    const r = await docker(['ps', '-a', '--filter', 'label=sdlcpoc.managed=true', '--filter', `label=sdlcpoc.owner=${this.cfg.ownerId}`, '--format', '{{.Names}}']);
    const out = [];
    for (const n of r.out.split('\n').filter(Boolean)) {
      const c = JSON.parse((await docker(['inspect', n])).out)[0]; const L = c.Config.Labels;
      const handle = this.handleOf(L['sdlcpoc.job'], Number(L['sdlcpoc.deadline']), Number(L['sdlcpoc.created'])); // rebuilt from labels only
      out.push({ handle, status: await this.status(handle) });
    }
    return out;
  }

  async reapOrphans(known: Set<string>) {
    const killed: string[] = [], removed: string[] = [];
    for (const { handle, status } of await this.list()) {
      const running = !TERMINAL.includes(status.state);
      if (!known.has(handle.jobId)) {
        if (running) { await docker(['kill', handle.ref], { allowFail: true }); killed.push(handle.jobId); }
        await docker(['rm', '-f', handle.ref], { allowFail: true }); removed.push(handle.jobId);
      }
    }
    return { killed, removed };
  }

  async cleanup(h: JobHandle) {
    await docker(['rm', '-f', h.ref], { allowFail: true });
    fs.rmSync(path.join(this.jobDir(h.jobId), 'secrets'), { recursive: true, force: true });
  }
}
